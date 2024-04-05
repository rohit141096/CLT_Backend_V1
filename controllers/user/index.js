require("dotenv").config();
const mongoose = require("mongoose");

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");

const User = require("../../models/User");
const ResetPasswordRequest = require("../../models/ResetPasswordRequest");

const { validationResult } = require("express-validator");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const speakeasy = require("@levminer/speakeasy");

const validations = require("../../utils/validations");
const {
  saveNewUserDetailsInUaMaster,
  saveUserLoggedInActivity,
  saveNewUserDetailsInMediaMaster,
  sendOneTimeValidationEmail,
  sendOneTimeValidationSMS,
} = require("../../utils/functions");

const JWT_SECRET = process.env.CMS_OWNER_JWT_SECRET;
const TOKEN_VALIDITY = process.env.CMS_OWNER_TOKEN_VALIDITY;
const TOKEN_MAX_VALIDITY = process.env.CMS_OWNER_TOKEN_MAX_VALIDITY;

module.exports.registerUserWithoutToken = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const { first_name, last_name, email_id, password, phone_number } = req.body;

  const isFirstNameValid = await validations.validateName(first_name);
  const isLastNameValid = await validations.validateName(last_name);
  const isEmailIDValid = await validations.validateEmailID(email_id);
  const isPasswordValid = await validations.validatePassword(password);
  const isPhoneNumberValid =
    await validations.validatePhoneNumber(phone_number);

  if (
    isFirstNameValid.status === false ||
    isLastNameValid.status === false ||
    isEmailIDValid.status === false ||
    isPasswordValid.status === false ||
    isPhoneNumberValid.status === false
  ) {
    const inputs_errors = [];

    if (isFirstNameValid.status === false) {
      inputs_errors.push("FIRST_NAME");
    }

    if (isLastNameValid.status === false) {
      inputs_errors.push("LAST_NAME");
    }

    if (isEmailIDValid.status === false) {
      inputs_errors.push("EMAIL_ID");
    }

    if (isPasswordValid.status === false) {
      inputs_errors.push("PASSWORD");
    }

    if (isPhoneNumberValid.status === false) {
      inputs_errors.push("PHONE_NUMBER");
    }

    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Invalid Inputs",
      fields: inputs_errors,
    });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const tfaSecret = await speakeasy.generateSecret({
    length: 20,
    name: "CMS4 CEG",
  });

  let user = new User({
    first_name: first_name.toLowerCase().replaceAll(/\s/g, ""),
    last_name: last_name.toLowerCase().replaceAll(/\s/g, ""),
    email_data: {
      email_id: email_id.toLowerCase(),
      is_validated: false,
    },
    password: hashedPassword,
    phone_data: {
      phone_number: phone_number,
      is_validated: false,
    },
    two_factor_auth_data: {
      secret: {
        ascii: tfaSecret.ascii,
        hex: tfaSecret.hex,
        base32: tfaSecret.base32,
        otpauth_url: tfaSecret.otpauth_url,
      },
    },
    role: "SUPER_ADMIN",
  });

  try {
    const savedUser = await user.save();

    return res.status(STATUS.CREATED).json({
      message: "User Created Successfully",
      data: savedUser.id,
    });
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
      error,
    });
  }
};

module.exports.loginUser = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const email_id = req.body.email_id.toLowerCase();
  const password = req.body.password;
  const ip_address = req.body.ip_address;
  const country_code = req.body.country_code;
  const country_name = req.body.country_name;
  const state = req.body.state;
  const city = req.body.city;
  const pincode = req.body.pincode;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  const isEmailIDValid = await validations.validateEmailID(email_id);

  if (isEmailIDValid.status === false) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: "Invalid Email ID",
    });
  } else {
    try {
      let user = await User.findOne({ "email_data.email_id": email_id });

      if (!user) {
        return res.status(STATUS.NOT_FOUND).json({
          message: "User not found",
        });
      } else {
        let loadedUser = user;

        let isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          let recent_login_attempts = [...user.recent_login_attempts];

          recent_login_attempts.push({
            attempted_on: new Date(),
            attempt_result: "FAILURE",
            attempt_stage: "LOGIN",
            remarks: "Entered Invalid Password",
            metadata: {
              ip_address: ip_address,
              country_code: country_code,
              country_name: country_name,
              state: state,
              city: city,
              pincode: pincode,
              latitude: latitude,
              longitude: longitude,
            },
          });

          user.recent_login_attempts = recent_login_attempts;

          try {
            const savedUser = await user.save();
            if (savedUser) {
              return res.status(STATUS.UNAUTHORISED).json({
                message: "Invalid password",
              });
            } else {
              console.log("error");
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
              });
            }
          } catch (error) {
            console.log("error");
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
              error,
            });
          }
        } else {
          if (user.is_active === false) {
            let recent_login_attempts = [...user.recent_login_attempts];

            recent_login_attempts.push({
              attempted_on: new Date(),
              attempt_result: "FAILURE",
              attempt_stage: "LOGIN",
              remarks: "User tried logging in was temporarily disabled.",
              metadata: {
                ip_address: ip_address,
                country_code: country_code,
                country_name: country_name,
                state: state,
                city: city,
                pincode: pincode,
                latitude: latitude,
                longitude: longitude,
              },
            });

            user.recent_login_attempts = recent_login_attempts;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.FORBIDDEN).json({
                  message: "User has been temporarily disabled",
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }

          let is_email_validated =
            user.email_data.is_validated === true ? true : false;
          let is_phone_validated =
            user.phone_data.is_validated === true ? true : false;
          let is_2fa_enabled =
            user.two_factor_auth_data.is_validated === true ? true : false;
          let is_2fa_validated = false;
          let is_all_validated = true;
          let to_be_validated = "";

          if (
            is_email_validated === false ||
            is_phone_validated === false ||
            is_2fa_validated === false
          ) {
            is_all_validated = false;

            to_be_validated =
              is_email_validated === false
                ? "email"
                : is_phone_validated === false
                  ? "phone"
                  : is_2fa_validated === false
                    ? "2fa"
                    : "";
          } else {
            is_all_validated = true;
          }

          let accessToken = await jwt.sign(
            {
              uid: loadedUser.id,
              type: "OWNER",
              role: loadedUser.role,
              is_2fa_enabled: is_2fa_enabled,
              is_validated: is_all_validated,
              to_be_validated: to_be_validated,
            },
            JWT_SECRET,
            { expiresIn: TOKEN_VALIDITY }
          );

          let refreshToken = await jwt.sign(
            {
              uid: loadedUser.id,
              type: "OWNER",
              role: loadedUser.role,
              is_2fa_enabled: is_2fa_enabled,
              is_validated: is_all_validated,
              to_be_validated: to_be_validated,
            },
            JWT_SECRET,
            { expiresIn: TOKEN_MAX_VALIDITY }
          );

          let response_data = {
            access_token: accessToken,
            refresh_token: refreshToken,
            user_id: loadedUser.id,
            name: `${loadedUser.first_name} ${loadedUser.last_name}`,
            email_id: loadedUser.email_data.email_id,
          };

          if (is_all_validated === false) {
            if (to_be_validated === "email") {
              const OTP = Math.floor(100000 + Math.random() * 900000);
              const timestamp = new Date();

              try {
                user.email_data.otp = OTP;
                user.email_data.timestamp = timestamp;

                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "LOGIN",
                  remarks: "Redirected to Email ID Validation",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                const savedUser = await user.save();
                if (savedUser) {
                  // Send Email to Registered Email ID With OTP

                  const sendEmailOTP = await sendOneTimeValidationEmail(
                    user.first_name,
                    user.email_data.email_id,
                    OTP
                  );

                  return res.status(STATUS.SUCCESS).json({
                    message: "Login Successfull",
                    data: response_data,
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            } else if (to_be_validated === "phone") {
              const OTP = Math.floor(100000 + Math.random() * 900000);
              const timestamp = new Date();

              try {
                user.phone_data.otp = OTP;
                user.phone_data.timestamp = timestamp;

                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "LOGIN",
                  remarks: "Redirected to Phone Number Validation",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                const savedUser = await user.save();
                if (savedUser) {
                  // Send Message to Registered Phone Number With OTP

                  const sendPhoneOTP = await sendOneTimeValidationSMS(
                    user.first_name,
                    user.phone_data.phone_number,
                    OTP
                  );

                  return res.status(STATUS.SUCCESS).json({
                    message: "Login Successfull",
                    data: response_data,
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                console.log(error);
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            } else if (to_be_validated === "2fa") {
              try {
                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "LOGIN",
                  remarks: "Redirected to 2FA Validation",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                const savedUser = await user.save();
                if (savedUser) {
                  return res.status(STATUS.SUCCESS).json({
                    message: "Login Successfull",
                    data: response_data,
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            } else {
              try {
                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "LOGIN",
                  remarks: "Redirected to 2FA Verification",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                const savedUser = await user.save();
                if (savedUser) {
                  return res.status(STATUS.SUCCESS).json({
                    message: "Login Successfull",
                    data: response_data,
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            }
          } else {
            try {
              let recent_login_attempts = [...user.recent_login_attempts];

              recent_login_attempts.push({
                attempted_on: new Date(),
                attempt_result: "SUCCESS",
                attempt_stage: "LOGIN",
                remarks: "Redirected to 2FA Verification",
                metadata: {
                  ip_address: ip_address,
                  country_code: country_code,
                  country_name: country_name,
                  state: state,
                  city: city,
                  pincode: pincode,
                  latitude: latitude,
                  longitude: longitude,
                },
              });

              user.recent_login_attempts = recent_login_attempts;

              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.SUCCESS).json({
                  message: "Login Successfull",
                  data: response_data,
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }
        }
      }
    } catch (error) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: MESSAGE.internalServerError,
        error,
      });
    }
  }
};

module.exports.validateUserEmailID = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const user_id = req.body.user_id;
  const ip_address = req.body.ip_address;
  const country_code = req.body.country_code;
  const country_name = req.body.country_name;
  const state = req.body.state;
  const city = req.body.city;
  const pincode = req.body.pincode;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  try {
    let user = await User.findOne({
      _id: user_id,
      is_archived: false,
      "email_data.is_validated": false,
    });

    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (user.is_active === false) {
        let recent_login_attempts = [...user.recent_login_attempts];

        recent_login_attempts.push({
          attempted_on: new Date(),
          attempt_result: "FAILURE",
          attempt_stage: "VALIDATE_EMAIL",
          remarks: "User tried logging in was temporarily disabled.",
          metadata: {
            ip_address: ip_address,
            country_code: country_code,
            country_name: country_name,
            state: state,
            city: city,
            pincode: pincode,
            latitude: latitude,
            longitude: longitude,
          },
        });

        user.recent_login_attempts = recent_login_attempts;

        try {
          const savedUser = await user.save();
          if (savedUser) {
            return res.status(STATUS.FORBIDDEN).json({
              message: "User has been temporarily disabled",
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      }

      if (user.email_data.is_validated === false) {
        if (user.email_data.otp === parseInt(req.body.otp)) {
          const otpGenerationTime = user.email_data.timestamp;
          const time_difference = Math.abs(
            new Date(otpGenerationTime) - new Date()
          );
          const minutes_difference = Math.floor(time_difference / 1000 / 60);

          const maxOtpValidity = parseInt(process.env.CMS_OWNER_OTP_VALIDITY);

          if (minutes_difference >= maxOtpValidity) {
            let recent_login_attempts = [...user.recent_login_attempts];

            recent_login_attempts.push({
              attempted_on: new Date(),
              attempt_result: "FAILURE",
              attempt_stage: "VALIDATE_EMAIL",
              remarks: "Entered OTP has been expired.",
              metadata: {
                ip_address: ip_address,
                country_code: country_code,
                country_name: country_name,
                state: state,
                city: city,
                pincode: pincode,
                latitude: latitude,
                longitude: longitude,
              },
            });

            user.recent_login_attempts = recent_login_attempts;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.TIME_OUT).json({
                  message: MESSAGE.otpExpired,
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          } else {
            user.email_data.is_validated = true;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                let is_phone_validated =
                  savedUser.phone_data.is_validated === true ? true : false;
                let is_2fa_enabled =
                  savedUser.two_factor_auth_data.is_validated === true
                    ? true
                    : false;
                let is_2fa_validated = false;
                let is_all_validated = true;
                let to_be_validated = "";

                if (
                  is_phone_validated === false ||
                  is_2fa_validated === false
                ) {
                  is_all_validated = false;

                  to_be_validated =
                    is_phone_validated === false
                      ? "phone"
                      : is_2fa_validated === false
                        ? "2fa"
                        : "";
                } else {
                  is_all_validated = true;
                }

                let accessToken = await jwt.sign(
                  {
                    uid: savedUser.id,
                    type: "OWNER",
                    role: savedUser.role,
                    is_2fa_enabled: is_2fa_enabled,
                    is_validated: is_all_validated,
                    to_be_validated: to_be_validated,
                  },
                  JWT_SECRET,
                  { expiresIn: TOKEN_VALIDITY }
                );

                let refreshToken = await jwt.sign(
                  {
                    uid: savedUser.id,
                    type: "OWNER",
                    role: savedUser.role,
                    is_2fa_enabled: is_2fa_enabled,
                    is_validated: is_all_validated,
                    to_be_validated: to_be_validated,
                  },
                  JWT_SECRET,
                  { expiresIn: TOKEN_MAX_VALIDITY }
                );

                let response_data = {
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  user_id: savedUser.id,
                  name: `${savedUser.first_name} ${savedUser.last_name}`,
                  email_id: savedUser.email_data.email_id,
                };

                if (is_all_validated === false) {
                  if (to_be_validated === "phone") {
                    const OTP = Math.floor(100000 + Math.random() * 900000);
                    const timestamp = new Date();

                    try {
                      user.phone_data.otp = OTP;
                      user.phone_data.timestamp = timestamp;
                      const savedUser = await user.save();
                      if (savedUser) {
                        let recent_login_attempts = [
                          ...user.recent_login_attempts,
                        ];

                        recent_login_attempts.push({
                          attempted_on: new Date(),
                          attempt_result: "SUCCESS",
                          attempt_stage: "VALIDATE_EMAIL",
                          remarks:
                            "Email validation successfull. Redirected to phone validation.",
                          metadata: {
                            ip_address: ip_address,
                            country_code: country_code,
                            country_name: country_name,
                            state: state,
                            city: city,
                            pincode: pincode,
                            latitude: latitude,
                            longitude: longitude,
                          },
                        });

                        user.recent_login_attempts = recent_login_attempts;

                        try {
                          const savedUser = await user.save();
                          if (savedUser) {
                            const sendPhoneOTP = await sendOneTimeValidationSMS(
                              user.first_name,
                              user.phone_data.phone_number,
                              OTP
                            );

                            // Send Message to Registered Phone Number With OTP

                            return res.status(STATUS.SUCCESS).json({
                              message: "Login Successfull",
                              data: response_data,
                            });
                          } else {
                            return res.status(STATUS.BAD_REQUEST).json({
                              message: MESSAGE.internalServerError,
                            });
                          }
                        } catch (error) {
                          return res.status(STATUS.BAD_REQUEST).json({
                            message: MESSAGE.internalServerError,
                            error,
                          });
                        }
                      } else {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: MESSAGE.internalServerError,
                        });
                      }
                    } catch (error) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                        error,
                      });
                    }
                  } else if (to_be_validated === "2fa") {
                    let recent_login_attempts = [...user.recent_login_attempts];

                    recent_login_attempts.push({
                      attempted_on: new Date(),
                      attempt_result: "SUCCESS",
                      attempt_stage: "VALIDATE_EMAIL",
                      remarks:
                        "Email validation successfull. Redirected to 2fa validation.",
                      metadata: {
                        ip_address: ip_address,
                        country_code: country_code,
                        country_name: country_name,
                        state: state,
                        city: city,
                        pincode: pincode,
                        latitude: latitude,
                        longitude: longitude,
                      },
                    });

                    user.recent_login_attempts = recent_login_attempts;

                    try {
                      const savedUser = await user.save();
                      if (savedUser) {
                        return res.status(STATUS.SUCCESS).json({
                          message: "Login Successfull",
                          data: response_data,
                        });
                      } else {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: MESSAGE.internalServerError,
                        });
                      }
                    } catch (error) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                        error,
                      });
                    }
                  } else {
                    let recent_login_attempts = [...user.recent_login_attempts];

                    recent_login_attempts.push({
                      attempted_on: new Date(),
                      attempt_result: "SUCCESS",
                      attempt_stage: "VALIDATE_EMAIL",
                      remarks:
                        "Email validation successfull. Redirected to 2fa validation.",
                      metadata: {
                        ip_address: ip_address,
                        country_code: country_code,
                        country_name: country_name,
                        state: state,
                        city: city,
                        pincode: pincode,
                        latitude: latitude,
                        longitude: longitude,
                      },
                    });

                    user.recent_login_attempts = recent_login_attempts;

                    try {
                      const savedUser = await user.save();
                      if (savedUser) {
                        return res.status(STATUS.SUCCESS).json({
                          message: "Login Successfull",
                          data: response_data,
                        });
                      } else {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: MESSAGE.internalServerError,
                        });
                      }
                    } catch (error) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                        error,
                      });
                    }
                  }
                } else {
                  let recent_login_attempts = [...user.recent_login_attempts];

                  recent_login_attempts.push({
                    attempted_on: new Date(),
                    attempt_result: "SUCCESS",
                    attempt_stage: "VALIDATE_EMAIL",
                    remarks:
                      "Email validation successfull. Redirected to 2fa validation.",
                    metadata: {
                      ip_address: ip_address,
                      country_code: country_code,
                      country_name: country_name,
                      state: state,
                      city: city,
                      pincode: pincode,
                      latitude: latitude,
                      longitude: longitude,
                    },
                  });

                  user.recent_login_attempts = recent_login_attempts;

                  try {
                    const savedUser = await user.save();
                    if (savedUser) {
                      return res.status(STATUS.SUCCESS).json({
                        message: "Login Successfull",
                        data: response_data,
                      });
                    } else {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                      });
                    }
                  } catch (error) {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                      error,
                    });
                  }
                }
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }
        } else {
          let recent_login_attempts = [...user.recent_login_attempts];

          recent_login_attempts.push({
            attempted_on: new Date(),
            attempt_result: "FAILURE",
            attempt_stage: "VALIDATE_EMAIL",
            remarks: "Entered OTP is invalid.",
            metadata: {
              ip_address: ip_address,
              country_code: country_code,
              country_name: country_name,
              state: state,
              city: city,
              pincode: pincode,
              latitude: latitude,
              longitude: longitude,
            },
          });

          user.recent_login_attempts = recent_login_attempts;

          try {
            const savedUser = await user.save();
            if (savedUser) {
              return res.status(STATUS.UNAUTHORISED).json({
                message: MESSAGE.unauthorized,
              });
            } else {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
              });
            }
          } catch (error) {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
              error,
            });
          }
        }
      } else {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.badRequest,
        });
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.validateUserPhoneNo = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const user_id = req.body.user_id;
  const ip_address = req.body.ip_address;
  const country_code = req.body.country_code;
  const country_name = req.body.country_name;
  const state = req.body.state;
  const city = req.body.city;
  const pincode = req.body.pincode;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  try {
    let user = await User.findOne({
      _id: user_id,
      is_archived: false,
      "phone_data.is_validated": false,
    });

    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (user.is_active === false) {
        let recent_login_attempts = [...user.recent_login_attempts];

        recent_login_attempts.push({
          attempted_on: new Date(),
          attempt_result: "FAILURE",
          attempt_stage: "VALIDATE_PHONE_NO",
          remarks: "User tried logging in was temporarily disabled.",
          metadata: {
            ip_address: ip_address,
            country_code: country_code,
            country_name: country_name,
            state: state,
            city: city,
            pincode: pincode,
            latitude: latitude,
            longitude: longitude,
          },
        });

        user.recent_login_attempts = recent_login_attempts;

        try {
          const savedUser = await user.save();
          if (savedUser) {
            return res.status(STATUS.FORBIDDEN).json({
              message: "User has been temporarily disabled",
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      }

      if (user.phone_data.is_validated === false) {
        if (user.phone_data.otp === parseInt(req.body.otp)) {
          const otpGenerationTime = user.phone_data.timestamp;
          const time_difference = Math.abs(
            new Date(otpGenerationTime) - new Date()
          );
          const minutes_difference = Math.floor(time_difference / 1000 / 60);

          const maxOtpValidity = parseInt(process.env.CMS_OWNER_OTP_VALIDITY);

          if (minutes_difference >= maxOtpValidity) {
            let recent_login_attempts = [...user.recent_login_attempts];

            recent_login_attempts.push({
              attempted_on: new Date(),
              attempt_result: "FAILURE",
              attempt_stage: "VALIDATE_PHONE_NO",
              remarks: "Entered OTP has been expired.",
              metadata: {
                ip_address: ip_address,
                country_code: country_code,
                country_name: country_name,
                state: state,
                city: city,
                pincode: pincode,
                latitude: latitude,
                longitude: longitude,
              },
            });

            user.recent_login_attempts = recent_login_attempts;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.TIME_OUT).json({
                  message: MESSAGE.otpExpired,
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          } else {
            user.phone_data.is_validated = true;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                let is_2fa_enabled =
                  savedUser.two_factor_auth_data.is_validated === true
                    ? true
                    : false;
                let is_2fa_validated = false;
                let is_all_validated = true;
                let to_be_validated = "";

                if (is_2fa_validated === false) {
                  is_all_validated = false;
                  to_be_validated = is_2fa_validated === false ? "2fa" : "";
                } else {
                  is_all_validated = true;
                }

                let accessToken = await jwt.sign(
                  {
                    uid: savedUser.id,
                    type: "OWNER",
                    role: savedUser.role,
                    is_2fa_enabled: is_2fa_enabled,
                    is_validated: is_all_validated,
                    to_be_validated: to_be_validated,
                  },
                  JWT_SECRET,
                  { expiresIn: TOKEN_VALIDITY }
                );

                let refreshToken = await jwt.sign(
                  {
                    uid: savedUser.id,
                    type: "OWNER",
                    role: savedUser.role,
                    is_2fa_enabled: is_2fa_enabled,
                    is_validated: is_all_validated,
                    to_be_validated: to_be_validated,
                  },
                  JWT_SECRET,
                  { expiresIn: TOKEN_MAX_VALIDITY }
                );

                let response_data = {
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  user_id: savedUser.id,
                  name: `${savedUser.first_name} ${savedUser.last_name}`,
                  email_id: savedUser.email_data.email_id,
                };

                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "VALIDATE_PHONE_NO",
                  remarks:
                    "Phone No. validation successfull. Redirected to 2fa validation.",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                try {
                  const savedUser = await user.save();
                  if (savedUser) {
                    return res.status(STATUS.SUCCESS).json({
                      message: "Login Successfull",
                      data: response_data,
                    });
                  } else {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                    });
                  }
                } catch (error) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                    error,
                  });
                }
              }
            } catch (error) {
              console.log(error);
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }
        } else {
          let recent_login_attempts = [...user.recent_login_attempts];

          recent_login_attempts.push({
            attempted_on: new Date(),
            attempt_result: "FAILURE",
            attempt_stage: "VALIDATE_PHONE_NO",
            remarks: "Entered OTP is invalid.",
            metadata: {
              ip_address: ip_address,
              country_code: country_code,
              country_name: country_name,
              state: state,
              city: city,
              pincode: pincode,
              latitude: latitude,
              longitude: longitude,
            },
          });

          user.recent_login_attempts = recent_login_attempts;

          try {
            const savedUser = await user.save();
            if (savedUser) {
              return res.status(STATUS.UNAUTHORISED).json({
                message: MESSAGE.unauthorized,
              });
            } else {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
              });
            }
          } catch (error) {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
              error,
            });
          }
        }
      } else {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.badRequest,
        });
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.getUserQrCodeToEnable2FA = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  if (!req.params.id) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const user_id = req.params.id;
  const ip_address = req.query.ip_address;
  const country_code = req.query.country_code;
  const country_name = req.query.country_name;
  const state = req.query.state;
  const city = req.query.city;
  const pincode = req.query.pincode;
  const latitude = req.query.latitude;
  const longitude = req.query.longitude;

  try {
    let user = await User.findOne({ _id: user_id, is_archived: false });

    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (user.is_active === false) {
        let recent_login_attempts = [...user.recent_login_attempts];

        recent_login_attempts.push({
          attempted_on: new Date(),
          attempt_result: "FAILURE",
          attempt_stage: "VALIDATE_2FA",
          remarks: "User tried logging in was temporarily disabled.",
          metadata: {
            ip_address: ip_address,
            country_code: country_code,
            country_name: country_name,
            state: state,
            city: city,
            pincode: pincode,
            latitude: latitude,
            longitude: longitude,
          },
        });

        user.recent_login_attempts = recent_login_attempts;

        try {
          const savedUser = await user.save();
          if (savedUser) {
            return res.status(STATUS.FORBIDDEN).json({
              message: "User has been temporarily disabled",
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      }

      let response_data = {
        qr_token: user.two_factor_auth_data.secret.otpauth_url,
      };

      let recent_login_attempts = [...user.recent_login_attempts];

      recent_login_attempts.push({
        attempted_on: new Date(),
        attempt_result: "PROCESSED",
        attempt_stage: "VALIDATE_2FA",
        remarks: "User 2fa QR Code request successfully processed.",
        metadata: {
          ip_address: ip_address,
          country_code: country_code,
          country_name: country_name,
          state: state,
          city: city,
          pincode: pincode,
          latitude: latitude,
          longitude: longitude,
        },
      });

      user.recent_login_attempts = recent_login_attempts;

      try {
        const savedUser = await user.save();
        if (savedUser) {
          return res.status(STATUS.SUCCESS).json({
            message: "Request Successfull",
            data: response_data,
          });
        } else {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
          });
        }
      } catch (error) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.internalServerError,
          error,
        });
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.checkUser2FAOTPValidity = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const user_id = req.body.user_id;
  const ip_address = req.body.ip_address;
  const country_code = req.body.country_code;
  const country_name = req.body.country_name;
  const state = req.body.state;
  const city = req.body.city;
  const pincode = req.body.pincode;
  const latitude = req.body.latitude;
  const longitude = req.body.longitude;

  try {
    let user = await User.findOne({ _id: user_id, is_archived: false });

    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (user.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      }

      const verify2FATokenValidity = await speakeasy.totp.verify({
        secret: user.two_factor_auth_data.secret.base32,
        encoding: "base32",
        token: req.body.otp,
      });

      if (verify2FATokenValidity === true) {
        if (user.two_factor_auth_data.is_validated === false) {
          user.two_factor_auth_data.is_validated = true;
          try {
            const savedUser = await user.save();
            if (savedUser) {
              let is_2fa_enabled =
                savedUser.two_factor_auth_data.is_validated === true
                  ? true
                  : false;
              let is_2fa_validated = is_2fa_enabled === true ? true : false;
              let is_all_validated = is_2fa_validated === true ? true : false;
              let to_be_validated = "";

              let accessToken = await jwt.sign(
                {
                  uid: savedUser.id,
                  type: "OWNER",
                  role: savedUser.role,
                  is_2fa_enabled: is_2fa_enabled,
                  is_validated: is_all_validated,
                  to_be_validated: to_be_validated,
                },
                JWT_SECRET,
                { expiresIn: TOKEN_VALIDITY }
              );

              let refreshToken = await jwt.sign(
                {
                  uid: savedUser.id,
                  type: "OWNER",
                  role: savedUser.role,
                  is_2fa_enabled: is_2fa_enabled,
                  is_validated: is_all_validated,
                  to_be_validated: to_be_validated,
                },
                JWT_SECRET,
                { expiresIn: TOKEN_MAX_VALIDITY }
              );

              let response_data = {
                access_token: accessToken,
                refresh_token: refreshToken,
                user_id: savedUser.id,
                name: `${savedUser.first_name} ${savedUser.last_name}`,
                email_id: savedUser.email_data.email_id,
              };

              // Check User Existance & Save User Details If Not Exists

              const user_to_save = {
                user_id: savedUser.id,
                first_name: savedUser.first_name,
                last_name: savedUser.last_name,
                user_type: "OWNER",
                activity_owner: "",
                role: savedUser.role,
                email_id: savedUser.email_data.email_id,
                phone_number: savedUser.phone_data.phone_number,
                avatar:
                  savedUser.profile_pic.pic_type === "MEDIA"
                    ? savedUser.profile_pic.media
                    : savedUser.profile_pic.pic_type === "AVATAR"
                      ? savedUser.profile_pic.avatar
                      : "",
              };

              let saveUserInUAMasterReq = await saveNewUserDetailsInUaMaster(
                user_to_save,
                response_data.access_token
              );

              if (saveUserInUAMasterReq.status === true) {
                const activity_to_save = {
                  activity_by: "OWNER",
                  user: savedUser.id,
                  activity_owner: "",
                  ip_address: ip_address,
                  country_code: country_code,
                  country_name: country_name,
                  city: city,
                  state: state,
                  latitude: latitude,
                  longitude: longitude,
                  pincode: pincode,
                };

                let saveLoggedInActivityReq = await saveUserLoggedInActivity(
                  activity_to_save,
                  response_data.access_token
                );

                if (saveLoggedInActivityReq.status === true) {
                  const user_to_save_in_media_master = {
                    user_id: savedUser.id,
                    first_name: savedUser.first_name,
                    last_name: savedUser.last_name,
                    user_type: "OWNER",
                    content_owner: "",
                    role: savedUser.role,
                    email_id: savedUser.email_data.email_id,
                    phone_number: savedUser.phone_data.phone_number,
                    avatar:
                      savedUser.profile_pic.pic_type === "MEDIA"
                        ? savedUser.profile_pic.media
                        : savedUser.profile_pic.pic_type === "AVATAR"
                          ? savedUser.profile_pic.avatar
                          : "",
                  };

                  let saveUserInMediaMasterReq =
                    await saveNewUserDetailsInMediaMaster(
                      user_to_save_in_media_master,
                      response_data.access_token
                    );

                  if (saveUserInMediaMasterReq.status === true) {
                    let recent_login_attempts = [...user.recent_login_attempts];

                    recent_login_attempts.push({
                      attempted_on: new Date(),
                      attempt_result: "SUCCESS",
                      attempt_stage: "VALIDATE_2FA",
                      remarks: "User successfully logged in by validating 2fa.",
                      metadata: {
                        ip_address: ip_address,
                        country_code: country_code,
                        country_name: country_name,
                        state: state,
                        city: city,
                        pincode: pincode,
                        latitude: latitude,
                        longitude: longitude,
                      },
                    });

                    user.recent_login_attempts = recent_login_attempts;

                    try {
                      const savedUser = await user.save();
                      if (savedUser) {
                        return res.status(STATUS.SUCCESS).json({
                          message: "Login Successfull",
                          data: response_data,
                        });
                      } else {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: MESSAGE.internalServerError,
                        });
                      }
                    } catch (error) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                        error,
                      });
                    }
                  } else {
                    console.log("Unable to save user in activity");

                    let recent_login_attempts = [...user.recent_login_attempts];

                    recent_login_attempts.push({
                      attempted_on: new Date(),
                      attempt_result: "FAILED",
                      attempt_stage: "VALIDATE_2FA",
                      remarks:
                        "2fa validation successfull. Failed to save user in media master.",
                      metadata: {
                        ip_address: ip_address,
                        country_code: country_code,
                        country_name: country_name,
                        state: state,
                        city: city,
                        pincode: pincode,
                        latitude: latitude,
                        longitude: longitude,
                      },
                    });

                    user.recent_login_attempts = recent_login_attempts;

                    try {
                      const savedUser = await user.save();
                      if (savedUser) {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: "Unable to save user in activity",
                        });
                      } else {
                        return res.status(STATUS.BAD_REQUEST).json({
                          message: MESSAGE.internalServerError,
                        });
                      }
                    } catch (error) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                        error,
                      });
                    }
                  }
                } else {
                  let recent_login_attempts = [...user.recent_login_attempts];

                  recent_login_attempts.push({
                    attempted_on: new Date(),
                    attempt_result: "FAILED",
                    attempt_stage: "VALIDATE_2FA",
                    remarks:
                      "2fa validation successfull. Failed to save activity in user activity.",
                    metadata: {
                      ip_address: ip_address,
                      country_code: country_code,
                      country_name: country_name,
                      state: state,
                      city: city,
                      pincode: pincode,
                      latitude: latitude,
                      longitude: longitude,
                    },
                  });

                  user.recent_login_attempts = recent_login_attempts;

                  try {
                    const savedUser = await user.save();
                    if (savedUser) {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: "Unable to save activity",
                      });
                    } else {
                      return res.status(STATUS.BAD_REQUEST).json({
                        message: MESSAGE.internalServerError,
                      });
                    }
                  } catch (error) {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                      error,
                    });
                  }
                }
              } else {
                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "FAILED",
                  attempt_stage: "VALIDATE_2FA",
                  remarks:
                    "2fa validation successfull. Failed to save user in user activity.",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                try {
                  const savedUser = await user.save();
                  if (savedUser) {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: "Unable to save user in activity",
                    });
                  } else {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                    });
                  }
                } catch (error) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                    error,
                  });
                }
              }
            } else {
              let recent_login_attempts = [...user.recent_login_attempts];

              recent_login_attempts.push({
                attempted_on: new Date(),
                attempt_result: "FAILED",
                attempt_stage: "VALIDATE_2FA",
                remarks:
                  "2fa validation successfull. Failed to login due to some technical error.",
                metadata: {
                  ip_address: ip_address,
                  country_code: country_code,
                  country_name: country_name,
                  state: state,
                  city: city,
                  pincode: pincode,
                  latitude: latitude,
                  longitude: longitude,
                },
              });

              user.recent_login_attempts = recent_login_attempts;

              try {
                const savedUser = await user.save();
                if (savedUser) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: "Unable to save user details",
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            }
          } catch (error) {
            console.log(error);

            let recent_login_attempts = [...user.recent_login_attempts];

            recent_login_attempts.push({
              attempted_on: new Date(),
              attempt_result: "FAILED",
              attempt_stage: "VALIDATE_2FA",
              remarks:
                "2fa validation successfull. Failed to login due to some technical error.",
              metadata: {
                ip_address: ip_address,
                country_code: country_code,
                country_name: country_name,
                state: state,
                city: city,
                pincode: pincode,
                latitude: latitude,
                longitude: longitude,
              },
            });

            user.recent_login_attempts = recent_login_attempts;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: "Unable to save user details",
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }
        } else {
          let is_2fa_enabled =
            user.two_factor_auth_data.is_validated === true ? true : false;
          let is_2fa_validated = is_2fa_enabled === true ? true : false;
          let is_all_validated = is_2fa_validated === true ? true : false;
          let to_be_validated = "";

          let accessToken = await jwt.sign(
            {
              uid: user.id,
              type: "OWNER",
              role: user.role,
              is_2fa_enabled: is_2fa_enabled,
              is_validated: is_all_validated,
              to_be_validated: to_be_validated,
            },
            JWT_SECRET,
            { expiresIn: TOKEN_VALIDITY }
          );

          let refreshToken = await jwt.sign(
            {
              uid: user.id,
              type: "OWNER",
              role: user.role,
              is_2fa_enabled: is_2fa_enabled,
              is_validated: is_all_validated,
              to_be_validated: to_be_validated,
            },
            JWT_SECRET,
            { expiresIn: TOKEN_MAX_VALIDITY }
          );

          let response_data = {
            access_token: accessToken,
            refresh_token: refreshToken,
            user_id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            email_id: user.email_data.email_id,
          };

          // Check User Existance & Save User Details If Not Exists

          const user_to_save = {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: "OWNER",
            activity_owner: "",
            role: user.role,
            email_id: user.email_data.email_id,
            phone_number: user.phone_data.phone_number,
            avatar:
              user.profile_pic.pic_type === "MEDIA"
                ? user.profile_pic.media
                : user.profile_pic.pic_type === "AVATAR"
                  ? user.profile_pic.avatar
                  : "",
          };

          let saveUserInUAMasterReq = await saveNewUserDetailsInUaMaster(
            user_to_save,
            response_data.access_token
          );

          if (saveUserInUAMasterReq.status === true) {
            const activity_to_save = {
              activity_by: "OWNER",
              user: user.id,
              activity_owner: "",
              ip_address: req.body.ip_address,
              country_code: req.body.country_code,
              country_name: req.body.country_name,
              city: req.body.city,
              state: req.body.state,
              latitude: req.body.latitude,
              longitude: req.body.longitude,
              pincode: req.body.pincode,
            };

            let saveLoggedInActivityReq = await saveUserLoggedInActivity(
              activity_to_save,
              response_data.access_token
            );

            if (saveLoggedInActivityReq.status === true) {
              const user_to_save_in_media_master = {
                user_id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                user_type: "OWNER",
                content_owner: "",
                role: user.role,
                email_id: user.email_data.email_id,
                phone_number: user.phone_data.phone_number,
                avatar:
                  user.profile_pic.pic_type === "MEDIA"
                    ? user.profile_pic.media
                    : user.profile_pic.pic_type === "AVATAR"
                      ? user.profile_pic.avatar
                      : "",
              };

              let saveUserInMediaMasterReq =
                await saveNewUserDetailsInMediaMaster(
                  user_to_save_in_media_master,
                  response_data.access_token
                );

              if (saveUserInMediaMasterReq.status === true) {
                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "SUCCESS",
                  attempt_stage: "VALIDATE_2FA",
                  remarks: "User successfully logged in by validating 2fa.",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                try {
                  const savedUser = await user.save();
                  if (savedUser) {
                    return res.status(STATUS.SUCCESS).json({
                      message: "Login Successfull",
                      data: response_data,
                    });
                  } else {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                    });
                  }
                } catch (error) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                    error,
                  });
                }
              } else {
                let recent_login_attempts = [...user.recent_login_attempts];

                recent_login_attempts.push({
                  attempted_on: new Date(),
                  attempt_result: "FAILED",
                  attempt_stage: "VALIDATE_2FA",
                  remarks:
                    "2fa validation successfull. Failed to save user in media master.",
                  metadata: {
                    ip_address: ip_address,
                    country_code: country_code,
                    country_name: country_name,
                    state: state,
                    city: city,
                    pincode: pincode,
                    latitude: latitude,
                    longitude: longitude,
                  },
                });

                user.recent_login_attempts = recent_login_attempts;

                try {
                  const savedUser = await user.save();
                  if (savedUser) {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: "Unable to save user in activity",
                    });
                  } else {
                    return res.status(STATUS.BAD_REQUEST).json({
                      message: MESSAGE.internalServerError,
                    });
                  }
                } catch (error) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                    error,
                  });
                }
              }
            } else {
              let recent_login_attempts = [...user.recent_login_attempts];

              recent_login_attempts.push({
                attempted_on: new Date(),
                attempt_result: "FAILED",
                attempt_stage: "VALIDATE_2FA",
                remarks:
                  "2fa validation successfull. Failed to save activity in user activity.",
                metadata: {
                  ip_address: ip_address,
                  country_code: country_code,
                  country_name: country_name,
                  state: state,
                  city: city,
                  pincode: pincode,
                  latitude: latitude,
                  longitude: longitude,
                },
              });

              user.recent_login_attempts = recent_login_attempts;

              try {
                const savedUser = await user.save();
                if (savedUser) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: "Unable to save activity",
                  });
                } else {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }
              } catch (error) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                  error,
                });
              }
            }
          } else {
            let recent_login_attempts = [...user.recent_login_attempts];

            recent_login_attempts.push({
              attempted_on: new Date(),
              attempt_result: "FAILED",
              attempt_stage: "VALIDATE_2FA",
              remarks:
                "2fa validation successfull. Failed to save user in user activity.",
              metadata: {
                ip_address: ip_address,
                country_code: country_code,
                country_name: country_name,
                state: state,
                city: city,
                pincode: pincode,
                latitude: latitude,
                longitude: longitude,
              },
            });

            user.recent_login_attempts = recent_login_attempts;

            try {
              const savedUser = await user.save();
              if (savedUser) {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: "Unable to save user in activity",
                });
              } else {
                return res.status(STATUS.BAD_REQUEST).json({
                  message: MESSAGE.internalServerError,
                });
              }
            } catch (error) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
                error,
              });
            }
          }
        }
      } else {
        let recent_login_attempts = [...user.recent_login_attempts];

        recent_login_attempts.push({
          attempted_on: new Date(),
          attempt_result: "FAILURE",
          attempt_stage: "VALIDATE_2FA",
          remarks: "Entered OTP is invalid.",
          metadata: {
            ip_address: ip_address,
            country_code: country_code,
            country_name: country_name,
            state: state,
            city: city,
            pincode: pincode,
            latitude: latitude,
            longitude: longitude,
          },
        });

        user.recent_login_attempts = recent_login_attempts;

        try {
          const savedUser = await user.save();
          if (savedUser) {
            return res.status(STATUS.UNAUTHORISED).json({
              message: MESSAGE.unauthorized,
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.validateUserForgotPasswordOTP = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Invalid Inputs`,
    });
  }

  let userDetails = null;
  let requestDetails = null;

  // Step 1 - Check If User Is Active

  try {
    let user = await User.findOne({
      _id: req.body.user_id,
      is_archived: false,
    });

    if (!user) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (user.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      } else {
        userDetails = user;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  // Step 2 - Check If User Has Any Open Request

  try {
    let resetPasswordReq = await ResetPasswordRequest.findOne({
      _id: req.body.request_id,
      user: userDetails.id,
      status: "OPEN",
    });
    if (!resetPasswordReq) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      // Step 2.1 - Check If The Request Is Currently Eligble To Validate OTP

      const request_activities_count = resetPasswordReq.activities.length;
      const recent_activity =
        resetPasswordReq.activities[request_activities_count - 1];

      if (
        recent_activity.activity_type === "REQUESTED" ||
        recent_activity.activity_type === "REJECTED" ||
        recent_activity.activity_type === "VALIDATION_SUCCESS" ||
        recent_activity.activity_type === "WITHDRAWN" ||
        recent_activity.activity_type === "SUCCESSFULLY_UPDATED"
      ) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "Invalid request.",
        });
      } else {
        requestDetails = resetPasswordReq;
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  // Step 3 - Check If This Request Belongs to The Same User

  if (userDetails.id != requestDetails.user) {
    return res.status(STATUS.FORBIDDEN).json({
      message: "You do not have required permissions to perform this action.",
    });
  }

  // Step 4 - Validate OTP By Checking The Recent Generated OTP for This Request

  const request_activities_count = requestDetails.activities.length;
  const recent_activity =
    requestDetails.activities[request_activities_count - 1];

  let recent_otp_activity = null;

  if (recent_activity.activity_type === "VALIDATION_FAILED") {
    let temp_activities = requestDetails.activities;
    const sorted_activities = temp_activities.reverse();
    sorted_activities.map((activity) => {
      if (recent_otp_activity === null) {
        if (
          activity.activity_type === "APPROVED" ||
          activity.activity_type === "REQUESTED_NEW_OTP"
        ) {
          recent_otp_activity = activity;
        }
      }
    });
    requestDetails.activities.reverse();
  } else {
    recent_otp_activity = recent_activity;
  }

  if (recent_otp_activity.validation_data.is_validated === false) {
    if (recent_otp_activity.validation_data.otp === parseInt(req.body.otp)) {
      const otpGenerationTime = recent_otp_activity.validation_data.timestamp;
      const time_difference =
        Math.abs(new Date(otpGenerationTime) - new Date()) / 36e5;

      const maxOtpValidity = parseInt(
        process.env.CMS_OWNER_RESET_PASSWORD_OTP_VALIDITY
      );

      if (time_difference >= maxOtpValidity) {
        const activity_data = {
          activity_type: "VALIDATION_FAILED",
          activity_by: "REQUESTER",
          user: userDetails.id,
          remarks: "OTP Expired",
        };

        requestDetails.activities.push(activity_data);

        try {
          const savedRequestDetails = await requestDetails.save();
          if (savedRequestDetails) {
            return res.status(STATUS.TIME_OUT).json({
              message: MESSAGE.otpExpired,
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      } else {
        recent_otp_activity.validation_data.is_validated = true;

        let update_this_req_activity = requestDetails.activities.find(
          (activity) => activity.id === recent_otp_activity.id
        );
        update_this_req_activity.validation_data.is_validated = true;

        const activity_data = {
          activity_type: "VALIDATION_SUCCESS",
          activity_by: "REQUESTER",
          user: userDetails.id,
        };

        requestDetails.activities.push(activity_data);

        try {
          const savedRequestDetails = await requestDetails.save();
          if (savedRequestDetails) {
            let response_data = {
              request_id: savedRequestDetails.id,
              user_id: savedRequestDetails.user,
            };

            return res.status(STATUS.SUCCESS).json({
              message: "Login Successfull",
              data: response_data,
            });
          } else {
            return res.status(STATUS.BAD_REQUEST).json({
              message: MESSAGE.internalServerError,
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      }
    } else {
      const activity_data = {
        activity_type: "VALIDATION_FAILED",
        activity_by: "REQUESTER",
        user: userDetails.id,
        remarks: "Entered Invalid OTP",
      };

      requestDetails.activities.push(activity_data);

      try {
        const savedRequestDetails = await requestDetails.save();
        if (savedRequestDetails) {
          return res.status(STATUS.UNAUTHORISED).json({
            message: MESSAGE.unauthorized,
          });
        } else {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
          });
        }
      } catch (error) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.internalServerError,
          error,
        });
      }
    }
  } else {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
    });
  }
};

module.exports.getAllAuthUsersWithoutPagination = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  const token = req.get("Authorization");
  let decodedToken = await jwt.decode(token);

  if (decodedToken.role != "SUPER_ADMIN") {
    return res.status(STATUS.FORBIDDEN).json({
      message: MESSAGE.unauthorized,
    });
  }

  const roles = req.query.roles;

  let rolesFilter;

  const rolesArray = roles.split(",");

  switch (roles) {
    case "null":
      rolesFilter = { $ne: null };
      break;
    case null:
      rolesFilter = { $ne: null };
      break;
    case undefined:
      rolesFilter = { $ne: null };
      break;
    case "":
      rolesFilter = { $ne: null };
      break;
    case "ALL":
      rolesFilter = { $ne: null };
      break;
    default:
      rolesFilter = { $in: rolesArray };
  }

  const created_on = req.query.created_on;

  let createdOnFilter;

  switch (created_on) {
    case "null":
      createdOnFilter = -1;
      break;
    case null:
      createdOnFilter = -1;
      break;
    case undefined:
      createdOnFilter = -1;
      break;
    case "":
      createdOnFilter = -1;
      break;
    case "RECENT":
      createdOnFilter = -1;
      break;
    case "OLD":
      createdOnFilter = 1;
      break;
    default:
      createdOnFilter = -1;
  }

  const created_by = req.query.created_by;

  let createdByFilter;

  switch (created_by) {
    case "null":
      createdByFilter = { $ne: null };
      break;
    case null:
      createdByFilter = { $ne: null };
      break;
    case undefined:
      createdByFilter = { $ne: null };
      break;
    case "":
      createdByFilter = { $ne: null };
      break;
    case "0":
      createdByFilter = { $ne: null };
      break;
    default:
      createdByFilter = new mongoose.Types.ObjectId(created_by);
  }

  try {
    const getUsersReq = await User.aggregate([
      {
        // $match: { _id: { $ne: decodedToken.uid }, is_archived: false, role: rolesFilter, created_by: createdByFilter }
        $match: { is_archived: false, role: rolesFilter },
      },
      {
        $lookup: {
          from: "users",
          localField: "created_by",
          foreignField: "_id",
          as: "created_by",
        },
      },
      {
        $addFields: {
          created_by: {
            $first: "$created_by",
          },
        },
      },
      {
        $project: {
          id: "$_id",
          _id: 0,
          first_name: "$first_name",
          last_name: "$last_name",
          email_data: "$email_data",
          phone_data: "$phone_data",
          two_factor_auth_data: "$two_factor_auth_data",
          role: "$role",
          created_by: {
            id: "$created_by._id",
            first_name: "$created_by.first_name",
            last_name: "$created_by.last_name",
            role: "$created_by.role",
          },
          is_active: "$is_active",
          createdAt: "$createdAt",
          updatedAt: "$updatedAt",
        },
      },
      {
        $sort: { createdAt: createdOnFilter },
      },
    ]);

    return res.status(STATUS.SUCCESS).json({
      message: "Request successfully processed.",
      data: getUsersReq,
    });
  } catch (error) {
    console.log(error);
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.badRequest,
      error,
    });
  }
};
