## Target

Support run .ts/.js file in any project,

run ts script by providing script path.

For running of ts script in other typescript project, we should get params for ts-node runtime, the solution is: get params in main process, and run the function `run-ts-script.ts` in child process using target ts script path as first param
