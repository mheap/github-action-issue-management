const { Toolkit } = require('actions-toolkit')

// Run your GitHub Action!
Toolkit.run(async tools => {

  tools.github.issues.addLabels({
    ...tools.context.issue,
    labels: ["needs-triage"]
  });

  tools.exit.success("Issue managed!")
})
