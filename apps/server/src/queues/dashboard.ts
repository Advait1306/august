import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { queue as AgentLoopQueue } from "./workers/agentLoopWorker";
import { queue as ServerToolExecutorQueue } from "./workers/serverToolExecutorWorker";
import { Express } from "express";
import { BullBoardGroupMQAdapter } from "groupmq";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ensureLoggedIn } from "connect-ensure-login";

const queues = [
  new BullBoardGroupMQAdapter(AgentLoopQueue, {
    displayName: "Agent Loop",
    description: "Handles all agent running jobs",
    readOnlyMode: false,
  }),
  new BullBoardGroupMQAdapter(ServerToolExecutorQueue, {
    displayName: "Server Tool Executor",
    description: "Executes server-side tools (todo_write, todo_read, etc.)",
    readOnlyMode: false,
  }),
];

const localStrategy = new LocalStrategy(
  {
    usernameField: "username",
    passwordField: "password",
  },
  (username, password, cb) => {
    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      return cb(null, { user: "bull-board" });
    }
    return cb(null, false);
  }
);

passport.serializeUser((user: Express.User, cb) => {
  cb(null, user);
});

passport.deserializeUser((user: Express.User, cb) => {
  cb(null, user);
});

passport.use(localStrategy);

const loginPageHtml = (invalid: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <title>Admin Login</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 300px;
    }
    h1 { margin: 0 0 1.5rem; font-size: 1.5rem; text-align: center; }
    input {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #000;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #333; }
    .error { color: #e53e3e; margin-bottom: 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Admin Login</h1>
    ${invalid ? '<p class="error">Invalid credentials</p>' : ""}
    <form method="post" action="/admin/queues/login">
      <input type="text" name="username" placeholder="Username" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">Login</button>
    </form>
  </div>
</body>
</html>
`;

const createBullDashboardAndAttachRouter = (app: Express) => {
  const adapter = new ExpressAdapter();
  adapter.setBasePath("/admin/queues");

  createBullBoard({
    queues,
    serverAdapter: adapter,
  });

  app.use(
    "/admin/*splat",
    session({
      secret: process.env.SESSION_SECRET || "bull-board-session-secret",
      cookie: {},
      saveUninitialized: true,
      resave: true,
    })
  );
  app.use("/admin/*splat", passport.initialize());
  app.use("/admin/*splat", passport.session());

  app.get("/admin/queues/login", (req, res) => {
    res.send(loginPageHtml(req.query.invalid === "true"));
  });

  app.post(
    "/admin/queues/login",
    passport.authenticate("local", {
      failureRedirect: "/admin/queues/login?invalid=true",
      successRedirect: "/admin/queues",
    })
  );

  app.use(
    "/admin/queues",
    ensureLoggedIn({ redirectTo: "/admin/queues/login" }),
    adapter.getRouter()
  );
};

export { createBullDashboardAndAttachRouter };
