// No global start instance needed:
// - No serverFn in this project uses `requireSupabaseAuth`, so no bearer
//   middleware is required.
// - The current @tanstack/react-start version does not export `createStart`,
//   and calling it caused an SSR crash. Keeping this file empty avoids that.
export {};
