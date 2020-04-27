const { Toolkit } = require('actions-toolkit')

// Run your GitHub Action!
Toolkit.run(async tools => {

  console.log(tools.context.event)

  // Add a triage label to new pull requests
  if (tools.context.event == "pull_request" && tools.context.payload.action == "opened") {
    await addLabels(tools, ["needs-triage"]);
    return;
  }

  // Update labels to show that it's being triaged when someone
  // with the correct permissions comments. Permission could mean
  // being in the correct team, or having write+ access
  if (tools.context.event == "issue_comment" && tools.context.payload.action == "created") {
    tools.log.info("Comment added")
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
