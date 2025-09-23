## Updates & Features

We must acknowledge that the web and shell are two different pices of software working together. Hence every feature that's dependent on a shell IPC call must have a flag called `isAvailable` which should be used to gracefully fail in the UI with a message like, "An update is required to use Agent Memory".

