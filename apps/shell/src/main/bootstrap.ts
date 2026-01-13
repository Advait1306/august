import { app } from 'electron'

// Differentiate storage paths for dev vs prod to prevent collisions
// This must happen before any other imports that might access userData
// Using dynamic import ensures this runs before other modules initialize
if (!app.isPackaged) {
  app.setName('August-Dev')
} else {
  app.setName('August')
}

// Dynamic import ensures all other modules load AFTER userData path is set
await import('./index')
