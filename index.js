const { Toolkit } = require("actions-toolkit");
const router = require("@mheap/action-router");
const { parse, end } = require("iso8601-duration");

Toolkit.run(async (tools) => {
  await router(
    {
      workflow_dispatch: syncLabels,
      "issues.opened": onIssueOpened,
      "issues.closed": onIssueClosed,
      "issues.reopened": onIssueReopened,
      // "pull_request.opened": onIssueOpened,
      // "pull_request.closed": onIssueClosed,
      // "pull_request.reopened": onIssueReopened,
      // "pull_request.review_requested": isWaitingForTeam,
      "issue_comment.created": onIssueComment,
    },
    [tools]
  );

  tools.exit.success("Issue managed!");
});

async function syncLabels(tools) {
  const labels = [
    {
      name: "needs-triage",
      description:
        "Issue has been opened but not responded to by a team member",
      color: "d73a4a",
    },
    {
      name: "waiting-for-author",
      description: "Team member has responded, awaiting OP reply",
      color: "945893",
    },
    {
      name: "waiting-for-team",
      description: "OP has responded, awaiting team reply",
      color: "E1811F",
    },
    {
      name: "closed-by-author",
      description: "The issue was closed by the OP",
      color: "87CA31",
    },
    {
      name: "closed-by-team",
      description: "The issue was closed by a team member",
      color: "EF9DDC",
    },
    {
      name: "necromancer",
      description:
        "A comment has been added to an old issue by a non-team member",
      color: "70543e",
    },
  ];

  for (const label of labels) {
    await tools.github.issues.createLabel({
      ...tools.context.repo,
      ...label,
    });
  }
}

async function onIssueOpened(tools) {
  return addLabels(tools, ["needs-triage"]);
}

async function onIssueReopened(tools) {
  await removeLabel(tools, "closed-by-team");
  await removeLabel(tools, "closed-by-author");
  return addLabels(tools, ["needs-triage"]);
}

// Update labels to show that it's being triaged when someone
// with the correct permissions comments. Permission could mean
// being in the correct team, or having write+ access
async function onIssueComment(tools) {
  const allowed = ["admin", "write"];
  const payload = tools.context.payload;

  // Fetch the actor's permissions on the repo
  const { data: perms } =
    await tools.github.repos.getCollaboratorPermissionLevel({
      ...tools.context.repo,
      username: payload.sender.login,
    });

  // If it's already closed
  if (payload.issue.closed_at) {
    // Commenting is not considered necromancy if they are a collaborator
    if (!allowed.includes(perms.permission)) {
      // Otherwise we check if the threshold has been met, or if this feature is disabled
      const necromancerDelay = tools.inputs.necromancer_delay;
      if (necromancerDelay !== "off") {
        // Has the grace period for adding comments ended?
        const now = Date.now();
        const closedDate = new Date(payload.issue.closed_at);
        const cutoffDate = end(parse(necromancerDelay), closedDate);

        if (now > cutoffDate) {
          await addLabels(tools, ["necromancer"]);
        }
      }
    }
    return;
  }

  // If it's the original author
  if (payload.sender.id === payload.issue.user.id) {
    await isWaitingForTeam(tools);
    return;
  }

  // If it's someone with write access
  if (allowed.includes(perms.permission)) {
    await removeLabel(tools, "needs-triage");
    await isWaitingForAuthor(tools, payload.issue.user.login);
    return;
  }

  // It's someone else
  // We want to keep waiting-for-author and waiting-for-team but also
  // flag it as having new people commenting
  await addLabels(tools, ["needs-triage"]);
}

async function isWaitingForTeam(tools) {
  await removeLabel(tools, "waiting-for-author");
  await addLabels(tools, ["waiting-for-team"]);
}

async function isWaitingForAuthor(tools, username) {
  await removeLabel(tools, "waiting-for-team");
  await addLabels(tools, ["waiting-for-author"]);
  await addAssignee(tools, username);
}

async function addAssignee(tools, username) {
  if (tools.inputs.disable_auto_assign === "on") {
    tools.log.info("Auto-assign disabled. Not adding: ", username);
    return;
  }

  tools.log.pending("Adding assignee: ", username);
  await tools.github.issues.addAssignees({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    assignees: [username],
  });
  tools.log.complete("Added assignee: ", username);
}

async function onIssueClosed(tools) {
  // TODO: Only try and remove labels that are on the issue
  // Read using payload.issue.labels on labels that we know about
  await removeLabel(tools, "needs-triage");
  await removeLabel(tools, "waiting-for-team");
  await removeLabel(tools, "waiting-for-author");

  const payload = tools.context.payload;
  if (payload.issue.user.id === payload.sender.id) {
    await addLabels(tools, ["closed-by-author"]);
  } else {
    await addLabels(tools, ["closed-by-team"]);
  }
}

async function addLabels(tools, labels) {
  tools.log.pending("Adding Labels: ", labels);
  await tools.github.issues.addLabels({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    labels,
  });
  tools.log.complete("Labels added: ", labels);
}

async function removeLabel(tools, name) {
  tools.log.pending("Removing Label: ", name);
  try {
    await tools.github.issues.removeLabel({
      ...tools.context.repo,
      issue_number: tools.context.issue.number,
      name,
    });
    tools.log.complete("Label removed: ", name);
  } catch (e) {
    tools.log.error("Error removing label: ", name);
  }
}
