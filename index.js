const { Toolkit } = require('actions-toolkit')
const { Octokit } = require("@octokit/rest");

// Run your GitHub Action!
Toolkit.run(async tools => {

  tools.github = new Octokit({
    "auth": process.env.GITHUB_TOKEN,
    log: {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error
    }
  })

  tools.log.info({
    ...tools.context.issue,
    labels: ["needs-triage"]
  })

  await tools.github.issues.addLabels({
    ...tools.context.issue,
    labels: ["needs-triage"]
  });

  tools.exit.success("Issue managed!")
})
