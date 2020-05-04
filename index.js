const { Toolkit } = require("actions-toolkit");
const router = require("@mheap/action-router");

/*
 * When an issue or a PR is opened, add the needs-triage label
 * When someone with write+ (configurable) access comments, add waiting-for-author label
 * When OP comments, add waiting-for-team label
 * When someone other than OP or maintainer comments, add needs-retriage label
 * When PR gets new commits, add updated-commits label
 * When PR is closed, remove all labels and add closed-by-op, closed-by-team
 *
 * Edge cases:
 *
 * OP has write+ access
 */

// Run your GitHub Action!
Toolkit.run(async (tools) => {
  await router(
    {
      // Add a triage label to new pull requests
      "issues.opened": onIssueOpened,
      "issues.closed": onIssueClosed,
      "pull_request.opened": onIssueOpened,
      "issue_comment.created": onIssueComment,
    },
    [tools]
  );

  tools.exit.success("Issue managed!");
});

async function onIssueOpened(tools) {
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
    await removeLabel(tools, "waiting-for-team");
    await addLabels(tools, ["waiting-for-author"]);
    return;
  }

  const payload = tools.context.payload;

  // If it's the original author
  if (payload.sender.id === payload.issue.user.id) {
    await removeLabel(tools, "waiting-for-author");
    await addLabels(tools, ["waiting-for-team"]);
    return;
  }
}

async function onIssueClosed(tools) {
  // TODO: Only try and remove labels that are on the issue
  // Read using payload.issue.labels on labels that we know about
  await removeLabel(tools, "needs-triage");
  await removeLabel(tools, "under-triage");

  const payload = tools.context.payload;
  if (payload.issue.user.id === payload.sender.id) {
    await addLabels(tools, ["closed-by-op"]);
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
