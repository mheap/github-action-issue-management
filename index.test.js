const { Toolkit } = require("actions-toolkit");
const mockedEnv = require("mocked-env");
const nock = require("nock");
nock.disableNetConnect();

describe("Issue Management", () => {
  let action, tools;

  Toolkit.run = jest.fn((actionFn) => {
    action = actionFn;
  });

  require(".");

  let restore;
  let restoreTest;
  beforeEach(() => {
    restore = mockedEnv({
      GITHUB_WORKFLOW: "demo-workflow",
      GITHUB_ACTION: "issue-management",
      GITHUB_ACTOR: "mheap",
      GITHUB_REPOSITORY: "mheap/missing-repo",
      GITHUB_WORKSPACE: "/github/workspace",
      GITHUB_SHA: "e21490305ed7ac0897b7c7c54c88bb47f7a6d6c4",
      GITHUB_EVENT_NAME: "",
      GITHUB_EVENT_PATH: "",
    });

    tools = new Toolkit();
    tools.context.loadPerTestEnv = function () {
      this.payload = process.env.GITHUB_EVENT_PATH
        ? require(process.env.GITHUB_EVENT_PATH)
        : {};
      this.event = process.env.GITHUB_EVENT_NAME;
    };
    tools.exit.success = jest.fn();
    tools.log.pending = jest.fn();
    tools.log.complete = jest.fn();
  });

  afterEach(() => {
    restore();
    restoreTest();

    if (!nock.isDone()) {
      console.error("Mocks not used: %j", nock.activeMocks());
      nock.cleanAll();
    }
    jest.resetModules();
  });

  describe("Issue Opened", () => {
    it("adds the needs-triage label", async () => {
      restoreTest = testEnv(tools, "issues", {
        action: "opened",
        issue: {
          number: 14,
        },
      });
      expectLabelsAdded(["needs-triage"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });
  });

  describe("Issue Reopened", () => {
    it("adds the needs-triage label", async () => {
      restoreTest = testEnv(tools, "issues", {
        action: "reopened",
        issue: {
          number: 14,
        },
      });
      expectLabelRemoved(["closed-by-team"]);
      expectLabelRemoved(["closed-by-author"]);
      expectLabelsAdded(["needs-triage"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });
  });

  describe("Issue Closed", () => {
    it("adds the closed-by-author label", async () => {
      restoreTest = testEnv(
        tools,
        "issues",
        closedBy({
          author: "mheap",
          closer: "mheap",
        })
      );
      expectLabelRemoved(["needs-triage"]);
      expectLabelRemoved(["waiting-for-team"]);
      expectLabelRemoved(["waiting-for-author"]);
      expectLabelsAdded(["closed-by-author"]);

      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("adds the closed-by-team label", async () => {
      restoreTest = testEnv(
        tools,
        "issues",
        closedBy({
          author: "mheap",
          closer: "another-user",
        })
      );
      expectLabelRemoved(["needs-triage"]);
      expectLabelRemoved(["waiting-for-team"]);
      expectLabelRemoved(["waiting-for-author"]);
      expectLabelsAdded(["closed-by-team"]);

      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });
  });

  describe("Issue Comment", () => {
    it("adds a necromancer label if the issue is closed and the commenter is not a collaborator", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "mheap",
          commenter: "another-person",
          closed_at: "2020-05-11T21:28:58Z",
        })
      );

      expectCollaboratorPermissionCheck("another-person", "read");
      expectLabelsAdded(["necromancer"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("does not add a necromancer label if the issue is closed and the commenter is a collaborator", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "issue-author",
          commenter: "mheap",
          closed_at: "2020-05-11T21:28:58Z",
        })
      );

      expectCollaboratorPermissionCheck("mheap", "admin");
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("adds waiting-for-author if someone with write+ permissions comments", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "mheap",
          commenter: "team-member",
        })
      );

      expectCollaboratorPermissionCheck("team-member", "admin");
      expectAssigneeAdded("mheap");
      expectLabelRemoved(["needs-triage"]);
      expectLabelRemoved(["waiting-for-team"]);
      expectLabelsAdded(["waiting-for-author"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("adds waiting-for-team if the author comments", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "mheap",
          commenter: "mheap",
        })
      );

      expectCollaboratorPermissionCheck("mheap", "read");
      expectLabelRemoved(["waiting-for-author"]);
      expectLabelsAdded(["waiting-for-team"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("adds needs-triage if a third party comments", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "mheap",
          commenter: "another-person",
        })
      );

      expectCollaboratorPermissionCheck("another-person", "read");
      expectLabelsAdded(["needs-triage"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });

    it("ignores the author's collaborator permission if an issue is raised by a team member", async () => {
      restoreTest = testEnv(
        tools,
        "issue_comment",
        commentFrom({
          author: "mheap",
          commenter: "mheap",
        })
      );

      expectCollaboratorPermissionCheck("mheap", "admin");
      expectLabelRemoved(["waiting-for-author"]);
      expectLabelsAdded(["waiting-for-team"]);
      await action(tools);
      expect(tools.exit.success).toHaveBeenCalledWith("Issue managed!");
    });
  });
});

function testEnv(tools, eventName, mockPayload) {
  jest.mock(
    "/github/workspace/event.json",
    () => {
      return mockPayload;
    },
    {
      virtual: true,
    }
  );

  const params = {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_EVENT_PATH: "/github/workspace/event.json",
  };

  const r = mockedEnv(params);
  tools.context.loadPerTestEnv();
  return r;
}

function expectLabelsAdded(labels) {
  nock("https://api.github.com")
    .post("/repos/mheap/missing-repo/issues/14/labels", {
      labels,
    })
    .reply(200);
}

function expectLabelRemoved(label) {
  nock("https://api.github.com")
    .delete(`/repos/mheap/missing-repo/issues/14/labels/${label}`)
    .reply(200);
}

function expectCollaboratorPermissionCheck(user, permission) {
  nock("https://api.github.com")
    .get(`/repos/mheap/missing-repo/collaborators/${user}/permission`)
    .reply(200, {
      permission,
    });
}

function expectAssigneeAdded(username) {
  nock("https://api.github.com")
    .post(`/repos/mheap/missing-repo/issues/14/assignees`, {
      assignees: [username],
    })
    .reply(200);
}

function commentFrom({ author, commenter, closed_at }) {
  return {
    action: "created",
    issue: {
      number: 14,
      user: {
        id: author,
        login: author,
      },
      closed_at,
    },
    sender: { id: commenter, login: commenter },
  };
}

function closedBy({ author, closer }) {
  return {
    action: "closed",
    issue: {
      number: 14,
      user: {
        id: author,
      },
    },
    sender: { id: closer },
  };
}
