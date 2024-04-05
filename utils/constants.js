const entitiesList = [
  "USER",
  "MEDIA",
  "AVATAR",
  "FOLDER",
  "FILE",
  "STATE",
  "DISTRICT",
  "CITY",
  "WEBSITE_TYPE",
  "HIERARCHY",
  "EXECUTOR_TYPE",
  "TEMP_EXECUTOR_TYPE",
  "ADMINISTRATOR_ROLE",
  "TEMP_ADMINISTRATOR_ROLE",
  "DEPARTMENT",
  "TEMP_DEPARTMENT",
  "OFFICER",
  "WEBSITE",
  "WEBSITE_USER",
  "WEBSITE_AGREEMENT",
  "WEBSITE_CRITERIA",
  "GO_LIVE_REQUEST",
  "WC_UPDATE_REQUEST",
  "WEBSITE_REQUEST",
  "WEBSITE_CREATION_REQUEST",
];

const activityTypes = [
  "LOGGED_IN",
  "LOGGED_OUT",
  "CREATED",
  "MODIFIED",
  "ACTIVATED",
  "DEACTIVATED",
  "ARCHIVED",
];

const childActivityTypes = [
  "RECEIVED",
  "SENT_BACK",
  "PROCESSED",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
];

module.exports = {
  entitiesList,
  activityTypes,
  childActivityTypes,
};
