// dependency
import "dotenv/config";

// app import
import app from "./src/app.js";

// load utils
import { logger } from "./src/utils/logger.js";

// load classes
import { users } from "./src/classes/Users.js";
import { congregations } from "./src/classes/Congregations.js";
import { congregationRequests } from "./src/classes/CongregationRequests.js";
import { announcements } from "./src/classes/Announcements.js";

const PORT = process.env.PORT || 8000;
const APP_VERSION = process.env.npm_package_version;

await announcements.loadAll();
await users.loadAll();
await congregations.loadAll();
await congregationRequests.loadAll();

app.listen(PORT, async () => {
  logger("info", JSON.stringify({ details: `server up and running (v${APP_VERSION})` }));
});
