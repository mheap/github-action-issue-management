const { Toolkit } = require("actions-toolkit");
const router = require("@mheap/action-router");

/*
 * When an issue or a PR is opened, add the needs-triage label
 * When someone with write+ (configurable) access comments, add waiting-for-author label
 * When OP comments, add awaiting-reply label
 * When someone other than OP or maintainer comments, add needs-reply label
 * When PR gets new commits, add updated-commits label
 * When PR is closed, remove all labels and add closed-by-op, closed-by-team labels
 */

// Run your GitHub Action!
Toolkit.run(async (tools) => {
  await router(
    {
      // Add a triage label to new pull requests
      "issue.opened": onPrOpened,
      "pull_request.opened": onPrOpened,
      "issue_comment.created": onIssueComment,
    },
    [tools]
  );

  tools.exit.success("Issue managed!");
});

async function onPrOpened(tools) {
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

  if (allowed.includes(perms.permission)) {
    await removeLabel(tools, "needs-triage");
    await addLabels(tools, ["under-triage"]);
  }
}

async function addLabels(tools, labels) {
  tools.log.pending("Adding Labels: ", labels);
  await tools.github.issues.addLabels({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    labels,
  });
  tools.log.error("Labels added: ", labels);
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
