const { Toolkit } = require('actions-toolkit')
const { Octokit } = require("@octokit/rest");

// Run your GitHub Action!
Toolkit.run(async tools => {
  // Add a triage label to new pull requests
  if (tools.context.event == "pull_request" && tools.context.payload.action == "opened") {
    await addLabels(tools, ["needs-triage"]);
    return;
  }

  // Update labels to show that it's being triaged when someone
  // with the correct permissions comments. Permission could mean
  // being in the correct team, or having write+ access
  if (tools.context.event == "issue_comment" && tools.context.payload.action == "created") {
    console.log("Running on issue comment")
    
    const allowed = ['admin', 'write'];

    const perms = (await tools.github.repos.getCollaboratorPermissionLevel({
      ...tools.context.repo,
      username: tools.context.actor
    })).data;

    if (allowed.includes(perms.permission)) {
      await removeLabel(tools, "needs-triage");
      await addLabels(tools, ["under-triage"]);
    }
    
  }

  tools.exit.success("Issue managed!")
})

async function addLabels(tools, labels) {
  tools.log.pending("Adding Labels: ", labels)
  await tools.github.issues.addLabels({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    labels
  });
  tools.log.complete("Labels added: ", labels)
}

async function removeLabel(tools, name) {
  tools.log.info("Removing Label: ", name)
  try {
    await tools.github.issues.removeLabel({
      ...tools.context.repo,
      issue_number: tools.context.issue.number,
      name
    });
    tools.log.complete("Label removed: ", name)
  } catch (e) {
    tools.log.complete("Error removing label: ", name)
  }
}