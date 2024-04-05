const axios = require("axios");
const crypto = require("crypto");

const API_ROOT = process.env.CMS_OWNER_API_ROOT;
const JWT_SECRET = process.env.CMS_OWNER_JWT_SECRET;
const MEDIA_MASTER_API_URL = process.env.MEDIA_MASTER_API_URL;
const UA_MASTER_API_URL = process.env.UA_MASTER_API_URL;
const CMS_OWNER_SENDGRID_API_KEY = process.env.CMS_OWNER_SENDGRID_API_KEY;
const CMS_OWNER_SENDGRID_SENDER_NAME =
  process.env.CMS_OWNER_SENDGRID_SENDER_NAME;
const CMS_OWNER_SENDGRID_SENDER_EMAIL_ID =
  process.env.CMS_OWNER_SENDGRID_SENDER_EMAIL_ID;
const CMS_OWNER_SENDGRID_VALIDATE_EMAIL_TEMPLATE_ID =
  process.env.CMS_OWNER_SENDGRID_VALIDATE_EMAIL_TEMPLATE_ID;

const CMS_OWNER_SMS_USERNAME = process.env.CMS_OWNER_MOBILE_ONE_USERNAME;
const CMS_OWNER_SMS_PASSWORD = process.env.CMS_OWNER_MOBILE_ONE_PASSWORD;
const CMS_OWNER_SMS_SENDER_ID = process.env.CMS_OWNER_MOBILE_ONE_SENDER_ID;
const CMS_OWNER_SMS_API_KEY = process.env.CMS_OWNER_MOBILE_ONE_API_KEY;
const CMS_OWNER_SMS_TEMPLATE_ID = process.env.CMS_OWNER_MOBILE_ONE_TEMPLATE_ID;

const sendgrid = require("@sendgrid/mail");
sendgrid.setApiKey(CMS_OWNER_SENDGRID_API_KEY);

const validations = require("./validations");
const statusCodes = require("./statusCodes");
const { activityTypes, entitiesList } = require("./constants");

const auth_config = (token) => {
  return {
    headers: {
      Authorization: token,
    },
  };
};

const getThisEntityCount = async (entity) => {
  let tempEntity = entity.toUpperCase();

  try {
    const getCounterReq = await axios.get(
      `${API_ROOT}counter?entity=${tempEntity}`
    );
    return getCounterReq.data.count;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const updateThisEntityCount = async (entity) => {
  let tempEntity = entity.toUpperCase();

  try {
    const data = {
      entity: tempEntity,
      token: JWT_SECRET,
    };

    const updateCounterReq = await axios.post(`${API_ROOT}counter`, data);
    return updateCounterReq.count;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const saveNewUserDetailsInUaMaster = async (user, token) => {
  const user_id = user.user_id;
  const first_name = user.first_name;
  const last_name = user.last_name;
  const user_type = user.user_type;
  const activity_owner = user.activity_owner;
  const role = user.role;
  const email_id = user.email_id;
  const phone_number = user.phone_number;
  const avatar = user.avatar;
  const access_token = token;

  const isFirstNameValid = await validations.validateName(first_name);
  const isLastNameValid = await validations.validateName(last_name);
  const isEmailIDValid = await validations.validateEmailID(email_id);
  const isPhoneNumberValid =
    await validations.validatePhoneNumber(phone_number);
  const isUserTypeValid = await validations.validateEnum(user_type, [
    "OWNER",
    "DEPARTMENT",
  ]);
  const isRoleValid = await validations.validateEnum(role, [
    "SUPER_ADMIN",
    "ADMIN",
    "CREATOR",
    "MODERATOR",
    "APPROVER",
  ]);

  if (
    isFirstNameValid.status === false ||
    isLastNameValid.status === false ||
    isEmailIDValid.status === false ||
    isUserTypeValid.status === false ||
    isPhoneNumberValid.status === false ||
    isRoleValid.status === false
  ) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (user_id === "" || user_id === null) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (access_token === "" || access_token === null) {
    return {
      status: false,
      message: "Please provide token to continue",
      data: {},
    };
  } else {
    const headers = await auth_config(access_token);

    const data = {
      user_id,
      first_name,
      last_name,
      user_type,
      activity_owner,
      role,
      email_id,
      phone_number,
      avatar,
    };

    try {
      const saveUserReq = await axios.post(
        `${UA_MASTER_API_URL}user`,
        data,
        headers
      );
      if (saveUserReq.status === statusCodes.CREATED) {
        return {
          status: true,
          message: "User saved successfully",
          data: {},
        };
      } else {
        return {
          status: false,
          message: "Failed to save user due to an unknwon technical error",
          data: {},
        };
      }
    } catch (error) {
      if (error.response.status === statusCodes.FORBIDDEN) {
        return {
          status: true,
          message: "User already exists",
          data: {},
        };
      } else if (error.response.status === statusCodes.VALIDATION_FAILED) {
        return {
          status: false,
          message: "Failed to save user due to invalid inputs",
          data: {},
        };
      } else if (error.response.status === statusCodes.UNAUTHORISED) {
        return {
          status: false,
          message: "Unauthorized request",
          data: {},
        };
      } else if (error.response.status === statusCodes.BAD_REQUEST) {
        return {
          status: false,
          message: "Failed to save user due to an unknwon technical error",
          data: {},
        };
      }
      return {
        status: false,
        message: "Failed to save user due to an unknwon technical error",
        data: {},
      };
    }
  }
};

const saveUserLoggedInActivity = async (activity, token) => {
  const activity_by = activity.activity_by;
  const user = activity.user;
  const activity_owner = activity.activity_owner;
  const ip_address = activity.ip_address;
  const country_code = activity.country_code;
  const country_name = activity.country_name;
  const city = activity.city;
  const state = activity.state;
  const latitude = activity.latitude;
  const longitude = activity.longitude;
  const pincode = activity.pincode;
  const access_token = token;

  const isActivityByValid = await validations.validateName(activity_by, [
    "OWNER",
    "DEPARTMENT",
  ]);
  const isIpAddressValid = await validations.validateIPaddress(ip_address);

  if (isActivityByValid.status === false || isIpAddressValid.status === false) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (user === "" || user === null) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (access_token === "" || access_token === null) {
    return {
      status: false,
      message: "Please provide token to continue",
      data: {},
    };
  } else {
    const headers = await auth_config(access_token);

    const data = {
      activity_by: activity_by,
      user: user,
      ip_address: ip_address,
      country_code: country_code,
      country_name: country_name,
      city: city,
      state: state,
      latitude: latitude,
      longitude: longitude,
      pincode: pincode,
      activity_owner: activity_owner,
    };

    try {
      const saveActivityReq = await axios.post(
        `${UA_MASTER_API_URL}activity/login`,
        data,
        headers
      );
      if (saveActivityReq.status === statusCodes.CREATED) {
        return {
          status: true,
          message: "Activity saved successfully",
          data: {},
        };
      } else {
        return {
          status: false,
          message: "Failed to save user due to an unknwon technical error",
          data: {},
        };
      }
    } catch (error) {
      if (error.response.status === statusCodes.FORBIDDEN) {
        return {
          status: false,
          message:
            "Invalid request, user for this activity not found in the ua master.",
          data: {},
        };
      } else if (error.response.status === statusCodes.VALIDATION_FAILED) {
        return {
          status: false,
          message: "Failed to save activity due to invalid inputs",
          data: {},
        };
      } else if (error.response.status === statusCodes.UNAUTHORISED) {
        return {
          status: false,
          message: "Unauthorized request",
          data: {},
        };
      } else if (error.response.status === statusCodes.BAD_REQUEST) {
        return {
          status: false,
          message: "Failed to save activity due to an unknwon technical error",
          data: {},
        };
      }
      return {
        status: false,
        message: "Failed to save activity due to an unknwon technical error",
        data: {},
      };
    }
  }
};

const saveNewUserDetailsInMediaMaster = async (user, token) => {
  const user_id = user.user_id;
  const first_name = user.first_name;
  const last_name = user.last_name;
  const user_type = user.user_type;
  const content_owner = user.content_owner;
  const role = user.role;
  const email_id = user.email_id;
  const phone_number = user.phone_number;
  const avatar = user.avatar;
  const access_token = token;

  const isFirstNameValid = await validations.validateName(first_name);
  const isLastNameValid = await validations.validateName(last_name);
  const isEmailIDValid = await validations.validateEmailID(email_id);
  const isPhoneNumberValid =
    await validations.validatePhoneNumber(phone_number);
  const isUserTypeValid = await validations.validateEnum(user_type, [
    "OWNER",
    "DEPARTMENT",
  ]);
  const isRoleValid = await validations.validateEnum(role, [
    "SUPER_ADMIN",
    "ADMIN",
    "CREATOR",
    "MODERATOR",
    "APPROVER",
  ]);

  if (
    isFirstNameValid.status === false ||
    isLastNameValid.status === false ||
    isEmailIDValid.status === false ||
    isUserTypeValid.status === false ||
    isPhoneNumberValid.status === false ||
    isRoleValid.status === false
  ) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (user_id === "" || user_id === null) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (access_token === "" || access_token === null) {
    return {
      status: false,
      message: "Please provide token to continue",
      data: {},
    };
  } else {
    const headers = await auth_config(access_token);

    const data = {
      user_id,
      first_name,
      last_name,
      user_type,
      content_owner,
      role,
      email_id,
      phone_number,
      avatar,
    };

    try {
      const saveUserReq = await axios.post(
        `${MEDIA_MASTER_API_URL}user`,
        data,
        headers
      );
      if (saveUserReq.status === statusCodes.CREATED) {
        return {
          status: true,
          message: "User saved successfully",
          data: {},
        };
      } else {
        return {
          status: false,
          message: "Failed to save user due to an unknwon technical error",
          data: {},
        };
      }
    } catch (error) {
      if (error.response.status === statusCodes.FORBIDDEN) {
        return {
          status: true,
          message: "User already exists",
          data: {},
        };
      } else if (error.response.status === statusCodes.VALIDATION_FAILED) {
        return {
          status: false,
          message: "Failed to save user due to invalid inputs",
          data: {},
        };
      } else if (error.response.status === statusCodes.UNAUTHORISED) {
        return {
          status: false,
          message: "Unauthorized request",
          data: {},
        };
      } else if (error.response.status === statusCodes.BAD_REQUEST) {
        return {
          status: false,
          message: "Failed to save user due to an unknwon technical error",
          data: {},
        };
      }
      return {
        status: false,
        message: "Failed to save user due to an unknwon technical error",
        data: {},
      };
    }
  }
};

const saveNewActivity = async (activity, token) => {
  const entity = activity.entity;
  const entity_id = activity.entity_id;
  const activity_type = activity.activity_type;
  const activity_by = activity.activity_by;
  const activity_owner = activity.activity_owner;
  const access_token = token;

  const isEntityValid = await validations.validateName(entity, entitiesList);
  const isActivityTypeValid = await validations.validateName(
    activity_type,
    activityTypes
  );
  const isActivityByValid = await validations.validateName(activity_by, [
    "OWNER",
    "DEPARTMENT",
  ]);

  if (
    isActivityByValid.status === false ||
    isEntityValid.status === false ||
    isActivityTypeValid.status === false
  ) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (entity_id === "" || entity_id === null) {
    return {
      status: false,
      message: "Validation failed due to invalid inputs",
      data: {},
    };
  } else if (access_token === "" || access_token === null) {
    return {
      status: false,
      message: "Please provide token to continue",
      data: {},
    };
  } else {
    const headers = await auth_config(access_token);

    const data = {
      entity: entity,
      entity_id: entity_id,
      activity_type: activity_type,
      activity_by: activity_by,
      activity_owner: activity_owner,
    };

    try {
      const saveActivityReq = await axios.post(
        `${UA_MASTER_API_URL}activity`,
        data,
        headers
      );
      if (saveActivityReq.status === statusCodes.CREATED) {
        return {
          status: true,
          message: "Activity saved successfully",
          data: saveActivityReq.data.data,
        };
      } else {
        return {
          status: false,
          message: "Failed to save activity due to an unknwon technical error",
          data: {},
        };
      }
    } catch (error) {
      if (error.status === statusCodes.FORBIDDEN) {
        return {
          status: false,
          message:
            "Invalid request, user for this activity not found in the ua master.",
          data: {},
        };
      } else if (error.status === statusCodes.VALIDATION_FAILED) {
        return {
          status: false,
          message: "Failed to save activity due to invalid inputs",
          data: {},
        };
      } else if (error.status === statusCodes.UNAUTHORISED) {
        return {
          status: false,
          message: "Unauthorized request",
          data: {},
        };
      } else if (error.status === statusCodes.BAD_REQUEST) {
        return {
          status: false,
          message: "Failed to save activity due to an unknwon technical error",
          data: {},
        };
      }
      return {
        status: false,
        message: "Failed to save activity due to an unknwon technical error",
        data: {},
      };
    }
  }
};

const sendOneTimeValidationEmail = async (name, to, otp) => {
  const email_data = {
    to: [to],
    from: {
      name: CMS_OWNER_SENDGRID_SENDER_NAME,
      email: CMS_OWNER_SENDGRID_SENDER_EMAIL_ID,
    },
    templateId: CMS_OWNER_SENDGRID_VALIDATE_EMAIL_TEMPLATE_ID,
    dynamicTemplateData: {
      OTP: otp,
    },
  };
  try {
    const sendEmailReq = await sendgrid.send(email_data);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

const sendOneTimeValidationSMS = async (name, to, otp) => {
  const message = `Dear ${name}, ${otp} is the OTP to validate your mobile number in the CMS. Regards, Centre for e-Governence, Govt.of karnataka.`;

  const mobileno = to;

  const encryptedPassword = crypto
    .createHash("sha1")
    .update(CMS_OWNER_SMS_PASSWORD.trim())
    .digest("hex");
  const generateHash = crypto
    .createHash("sha512")
    .update(
      `${CMS_OWNER_SMS_USERNAME}${CMS_OWNER_SMS_SENDER_ID}${message}${CMS_OWNER_SMS_API_KEY}`
    )
    .digest("hex");
  const sms_service_type = "otpmsg";

  const url_data = {
    username: CMS_OWNER_SMS_USERNAME.trim(),
    password: encryptedPassword.trim(),
    senderid: CMS_OWNER_SMS_SENDER_ID.trim(),
    content: message.trim(),
    smsservicetype: sms_service_type,
    mobileno: mobileno.trim(),
    key: generateHash.trim(),
    templateid: CMS_OWNER_SMS_TEMPLATE_ID.trim(),
  };

  const send_sms = await axios.post(
    `http://smsmobileone.karnataka.gov.in/index.php/sendmsg`,
    url_data
  );
  console.log(send_sms);
  return true;
};

const getPercentage = (partialValue, totalValue) => {
  return (100 * partialValue) / totalValue;
};

module.exports = {
  getPercentage,
  getThisEntityCount,
  updateThisEntityCount,
  saveNewUserDetailsInUaMaster,
  saveUserLoggedInActivity,
  saveNewUserDetailsInMediaMaster,
  saveNewActivity,
  sendOneTimeValidationEmail,
  sendOneTimeValidationSMS,
};
