## Updates & Features

We must acknowledge that the web and shell are two different pices of software working together. Hence every feature that's dependent on a shell IPC call must have a flag called `isAvailable` which should be used to gracefully fail in the UI with a message like, "An update is required to use Agent Memory".

## Functions

Methods exposed by the shell must be stateless, all state should be stored on the app side. This let's us move the app from one shell to another without having to depend on the state being caried.

