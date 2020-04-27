const { Toolkit } = require('actions-toolkit')

// Run your GitHub Action!
Toolkit.run(async tools => {

  console.log(tools.context)

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

    const allowed = ["write", "admin"];

    const perms = (await tools.github.repos.getCollaboratorPermissionLevel({
      ...tools.context.repo,
      username: tools.context.actor
    }));

    console.log(perms);

    if (allowed.includes(perms.permission)) {
      await removeLabels(tools, ["needs-triage"]);
      await addLabels(tools, ["under-triage"]);
    }
  }

  tools.exit.success("Issue managed!")
})

function addLabels(tools, labels) {
  return tools.github.issues.addLabels({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    labels
  });
}

function removeLabels(tools, labels) {
  return tools.github.issues.removeLabels({
    ...tools.context.repo,
    issue_number: tools.context.issue.number,
    labels
  });
}
