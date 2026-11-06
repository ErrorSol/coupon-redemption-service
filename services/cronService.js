import cron from "node-cron";

// Initialize all crons
const initializeCrons = () => {
  scheduleBasicCron();
  scheduleAnotherCron();

  console.log("Cron jobs initialized");
};

// Basic cron job - runs every hour
const scheduleBasicCron = () => {
  cron.schedule("0 * * * *", async () => {
    //Call the cron function to be executed
    console.log("Running basic cron");
  });
};

// Another cron job - runs every day at 12:00 AM
const scheduleAnotherCron = () => {
  cron.schedule("0 0 * * *", async () => {
    //Call the cron function to be executed
    console.log("Running another cron");
  });
};

export { initializeCrons };
