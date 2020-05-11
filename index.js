const { Toolkit } = require("actions-toolkit");
const router = require("@mheap/action-router");

/*
 * When someone with write+ (configurable) access comments, add waiting-for-author label
 *
 * Edge cases:
 *
 * OP has write+ access
 * Issue is closed when a comment is added. Check status before adding labels. What should we do if comment is added to a closed issue?
 */

// Run your GitHub Action!
Toolkit.run(async (tools) => {
  await router(
    {
      "issues.opened": onIssueOpened,
      "issues.closed": onIssueClosed,
      "issues.reopened": onIssueReopened,
      "pull_request.opened": onIssueOpened,
      "pull_request.closed": onIssueClosed,
      "pull_request.reopened": onIssueReopened,
      "pull_request.review_requested": isWaitingForTeam,
      "issue_comment.created": onIssueComment,
    },
    [tools]
  );

  tools.exit.success("Issue managed!");
});

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

  const perms = (
    await tools.github.repos.getCollaboratorPermissionLevel({
      ...tools.context.repo,
      username: tools.context.actor,
    })
  ).data;

  // If it's someone with write access
  if (allowed.includes(perms.permission)) {
    await removeLabel(tools, "needs-triage");
    await isWaitingForAuthor(tools);
    return;
  }

  const payload = tools.context.payload;

  // If it's the original author
  if (payload.sender.id === payload.issue.user.id) {
    await isWaitingForTeam(tools);
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

async function isWaitingForAuthor(tools) {
  await removeLabel(tools, "waiting-for-team");
  await addLabels(tools, ["waiting-for-author"]);
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
  tools.log.info("Removing Label: ", name);
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
