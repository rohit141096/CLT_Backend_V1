require("dotenv").config();

const STATUS = require("../../utils/statusCodes");
const MESSAGE = require("../../utils/messages");

const ResetPasswordRequest = require("../../models/ResetPasswordRequest");
const User = require("../../models/User");

const { validationResult } = require("express-validator");

const validations = require("../../utils/validations");

const bcrypt = require("bcryptjs");

const {
  getThisEntityCount,
  updateThisEntityCount,
} = require("../../utils/functions");

module.exports.requestResetPasswordPreLogin = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  try {
    let user = await User.findOne({
      "email_data.email_id": req.body.email_id,
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
      }

      if (user.role === "SUPER_ADMIN") {
        return res.status(STATUS.SUCCESS).json({
          message: "Reset Password Request Proccessed Successfully.",
          data: {
            user_id: user.id,
            user_name: `${user.first_name}`,
            role: user.role,
          },
        });
      } else {
        // Step 1 - Check If There Are Any Open Reset Password Requests With This User

        try {
          const checkOpenRequestsHandler = await ResetPasswordRequest.findOne({
            user: user.id,
            status: "OPEN",
          });
          if (checkOpenRequestsHandler) {
            return res.status(STATUS.ACCEPTED).json({
              message: "Reset Password Request Already Exists!",
              data: {
                user_id: user.id,
                user_name: `${user.first_name}`,
                role: user.role,
                reset_password_request_readable_id:
                  checkOpenRequestsHandler.request_id,
                requested_on: checkOpenRequestsHandler.createdAt,
                reset_password_request_id: checkOpenRequestsHandler.id,
              },
            });
          } else {
            // Step 2 - Check If Any Of Request By This User Was Rejected in The Past 24 Hours

            try {
              const checkRejectedRequestsHandler =
                await ResetPasswordRequest.findOne({
                  user: user.id,
                  status: "CLOSED",
                }).sort({ _id: 1 });
              if (checkRejectedRequestsHandler) {
                const activitiesLength =
                  checkRejectedRequestsHandler.activities.length;
                if (
                  checkRejectedRequestsHandler.activities[activitiesLength - 1]
                    .activity_type === "REJECTED"
                ) {
                  const requestRejectedOn =
                    checkRejectedRequestsHandler.activities[
                      activitiesLength - 1
                    ].createdAt;

                  const time_difference =
                    Math.abs(new Date(requestRejectedOn) - new Date()) / 36e5;

                  const submitResetPasswordAfterRejectionValidity = parseInt(
                    process.env
                      .CMS_OWNER_RESET_PASSWORD_AFTER_REJECTION_VALIDITY
                  );

                  if (
                    submitResetPasswordAfterRejectionValidity >= time_difference
                  ) {
                    return res.status(STATUS.TIME_OUT).json({
                      message: MESSAGE.unauthorized,
                      data: {
                        user_id: user.id,
                        user_name: `${user.first_name}`,
                        role: user.role,
                        try_after: Math.ceil(24 - time_difference),
                      },
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

            // Step 3 - Create A New Reset Password Request

            // CHECK ENTITY COUNT

            const entity_count = await getThisEntityCount(
              "RESET_PASSWORD_REQUEST"
            );
            if (entity_count === false) {
              return res.status(STATUS.BAD_REQUEST).json({
                message: MESSAGE.internalServerError,
              });
            }

            const resetPasswordRequest = new ResetPasswordRequest({
              request_id: entity_count + 1,
              user: user.id,
              role: user.role,
              activities: [
                {
                  activity_type: "REQUESTED",
                  activity_by: "REQUESTER",
                  user: user.id,
                },
              ],
            });

            try {
              const savedResetPasswordRequest =
                await resetPasswordRequest.save();

              if (savedResetPasswordRequest) {
                // UPDATE ENTITY COUNT

                const saveEntityCount = await updateThisEntityCount(
                  "RESET_PASSWORD_REQUEST"
                );
                if (saveEntityCount === false) {
                  return res.status(STATUS.BAD_REQUEST).json({
                    message: MESSAGE.internalServerError,
                  });
                }

                /*

                                    Incomplete - Add Notify Admin / Super Admin Login Here

                                */

                global.io.to("owner-super-admin").emit("new_request");

                return res.status(STATUS.SUCCESS).json({
                  message: "Reset Password Request Proccessed Successfully.",
                  data: {
                    user_id: user.id,
                    user_name: `${user.first_name}`,
                    role: user.role,
                  },
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
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.updateResetPasswordRequestStatus = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  let requestDetails = null;
  let requesterDetails = null;
  let approverDetails = null;

  try {
    const requestDetailsHandler = await ResetPasswordRequest.findById(
      req.params.id
    );
    if (requestDetailsHandler) {
      if (requestDetailsHandler.status === "CLOSED") {
        return res.status(STATUS.FORBIDDEN).json({
          message: "Request has been already closed.",
        });
      } else {
        requestDetails = requestDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  try {
    const requesterDetailsHandler = await User.findById(requestDetails.user, {
      is_archived: false,
    });
    if (!requesterDetailsHandler) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (requesterDetailsHandler.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      } else {
        requesterDetails = requesterDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  try {
    const approverDetailsHandler = await User.findById(req.body.approver_id, {
      is_archived: false,
    });
    if (!approverDetailsHandler) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "Approver not found",
      });
    } else {
      if (approverDetailsHandler.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message:
            "Approver doesn't have required permissions to perform this action.",
        });
      } else {
        approverDetails = approverDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  if (requesterDetails.role === "ADMIN") {
    if (approverDetails.role !== "SUPER_ADMIN") {
      return res.status(STATUS.UNAUTHORISED).json({
        message: MESSAGE.unauthorized,
      });
    } else {
      if (req.body.status === "APPROVED") {
        const OTP = Math.floor(100000 + Math.random() * 900000);
        const timestamp = new Date();

        const activity_data = {
          activity_type: "APPROVED",
          activity_by: "APPROVER",
          user: approverDetails.id,
          validation_data: {
            otp: OTP,
            timestamp: timestamp,
            is_validated: false,
          },
        };

        let request_activities = requestDetails.activities;
        request_activities.push(activity_data);

        requestDetails.activities = request_activities;

        try {
          const savedRequest = await requestDetails.save();
          if (savedRequest) {
            /*

                            Incomplete - Add Send OTP Via Email & SMS Logic Here

                        */
            console.log(OTP);
            return res.status(STATUS.SUCCESS).json({
              message: "Reset Password Request Status Updated Successfully.",
              data: {
                request_id: requestDetails.id,
              },
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      } else if (req.body.status === "REJECTED") {
        const activity_data = {
          activity_type: "REJECTED",
          activity_by: "APPROVER",
          user: approverDetails.id,
          remarks: req.body.remarks,
        };

        let request_activities = requestDetails.activities;
        request_activities.push(activity_data);

        requestDetails.activities = request_activities;
        requestDetails.status = "CLOSED";

        try {
          const savedRequest = await requestDetails.save();
          if (savedRequest) {
            /*

                            Incomplete - Notify User Via Email & SMS Logic Here

                        */
            return res.status(STATUS.SUCCESS).json({
              message: "Reset Password Request Status Updated Successfully.",
              data: {
                request_id: requestDetails.id,
              },
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
    }
  } else if (requesterDetails.role === "SUPER_ADMIN") {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
    });
  } else {
    if (
      approverDetails.role !== "ADMIN" ||
      approverDetails.role !== "SUPER_ADMIN"
    ) {
      return res.status(STATUS.UNAUTHORISED).json({
        message: MESSAGE.unauthorized,
      });
    } else {
      if (req.body.status === "APPROVED") {
        const OTP = Math.floor(100000 + Math.random() * 900000);
        const timestamp = new Date();

        const activity_data = {
          activity_type: "APPROVED",
          activity_by: "APPROVER",
          user: approverDetails.id,
          validation_data: {
            otp: OTP,
            timestamp: timestamp,
            is_validated: false,
          },
        };

        let request_activities = requestDetails.activities;
        request_activities.push(activity_data);

        requestDetails.activities = request_activities;

        try {
          const savedRequest = await requestDetails.save();
          if (savedRequest) {
            /*

                            Incomplete - Add Send OTP Via Email & SMS Logic Here

                        */
            console.log(OTP);
            return res.status(STATUS.SUCCESS).json({
              message: "Reset Password Request Status Updated Successfully.",
              data: {
                request_id: requestDetails.id,
              },
            });
          }
        } catch (error) {
          return res.status(STATUS.BAD_REQUEST).json({
            message: MESSAGE.internalServerError,
            error,
          });
        }
      } else if (req.body.status === "REJECTED") {
        const activity_data = {
          activity_type: "REJECTED",
          activity_by: "APPROVER",
          user: approverDetails.id,
          remarks: req.body.remarks,
        };

        let request_activities = requestDetails.activities;
        request_activities.push(activity_data);

        requestDetails.activities = request_activities;
        requestDetails.status = "CLOSED";

        try {
          const savedRequest = await requestDetails.save();
          if (savedRequest) {
            /*

                            Incomplete - Notify User Via Email & SMS Logic Here

                        */
            return res.status(STATUS.SUCCESS).json({
              message: "Reset Password Request Status Updated Successfully.",
              data: {
                request_id: requestDetails.id,
              },
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
    }
  }
};

module.exports.getThisResetPasswordRequest = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  if (!req.params.id) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Request ID is Required.`,
    });
  }

  try {
    let resetPasswordReq = await ResetPasswordRequest.findOne({
      _id: req.params.id,
    })
      .populate("user", "id first_name last_name role")
      .populate("activities.user", "id first_name last_name role");
    if (!resetPasswordReq) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      return res.status(STATUS.SUCCESS).json({
        message: "Reset Password Request Found",
        data: resetPasswordReq,
      });
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }
};

module.exports.resetUserPassword = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  let userDetails = null;

  try {
    const userDetailsHandler = await User.findById(req.params.id, {
      is_archived: false,
    });
    if (!userDetailsHandler) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (userDetailsHandler.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      } else {
        userDetails = userDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  let resetPasswordRequestDetails = null;

  if (userDetails.role === "SUPER_ADMIN") {
    const new_password = req.body.new_password;
    const repeat_password = req.body.repeat_password;

    if (new_password === repeat_password) {
      const isPasswordValid = await validations.validatePassword(new_password);
      if (isPasswordValid === false) {
        return res.status(STATUS.VALIDATION_FAILED).json({
          message: "Invalid Inputs.",
        });
      } else {
        const hashedPassword = await bcrypt.hash(new_password, 12);
        userDetails.password = hashedPassword;
      }
    } else {
      return res.status(STATUS.VALIDATION_FAILED).json({
        message: "Invalid Inputs.",
      });
    }
  } else {
    try {
      const resetPwdReqHandler = await ResetPasswordRequest.findOne({
        user: req.params.id,
        status: "OPEN",
      }).sort({ _id: 1 });
      if (!resetPwdReqHandler) {
        return res.status(STATUS.NOT_FOUND).json({
          message: "Request not found",
        });
      } else {
        const activitiesLength = resetPwdReqHandler.activities.length;

        let isRecentOTPActivityValidated = false;
        let isRecentActivityValidationSuccessfull =
          resetPwdReqHandler.activities[activitiesLength - 1].activity_type ===
          "VALIDATION_SUCCESS"
            ? true
            : false;

        let recent_otp_activity = null;

        let temp_activities = resetPwdReqHandler.activities;
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
        resetPwdReqHandler.activities.reverse();

        if (recent_otp_activity === null) {
          return res.status(STATUS.FORBIDDEN).json({
            message: "Something went wrong.",
          });
        } else {
          isRecentOTPActivityValidated =
            recent_otp_activity.validation_data.is_validated === true
              ? true
              : false;
        }

        if (
          isRecentOTPActivityValidated === true &&
          isRecentActivityValidationSuccessfull === true
        ) {
          const new_password = req.body.new_password;
          const repeat_password = req.body.repeat_password;

          if (new_password === repeat_password) {
            const isPasswordValid =
              await validations.validatePassword(new_password);
            if (isPasswordValid === false) {
              return res.status(STATUS.VALIDATION_FAILED).json({
                message: "Invalid Inputs.",
              });
            } else {
              const hashedPassword = await bcrypt.hash(new_password, 12);
              userDetails.password = hashedPassword;
              resetPasswordRequestDetails = resetPwdReqHandler;
            }
          } else {
            return res.status(STATUS.VALIDATION_FAILED).json({
              message: "Invalid Inputs.",
            });
          }
        } else {
          return res.status(STATUS.UNAUTHORISED).json({
            message: "Request Not Yet Validated By Requester.",
            data: {
              request_id: resetPwdReqHandler.id,
            },
          });
        }
      }
    } catch (error) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: MESSAGE.internalServerError,
        error,
      });
    }
  }

  try {
    const updateUserPassword = await userDetails.save();
    if (updateUserPassword) {
      if (userDetails.role !== "SUPER_ADMIN") {
        const activity_data = {
          activity_type: "SUCCESSFULLY_UPDATED",
          activity_by: "REQUESTER",
          user: updateUserPassword.id,
        };

        let request_activities = resetPasswordRequestDetails.activities;
        request_activities.push(activity_data);

        resetPasswordRequestDetails.activities = request_activities;
        resetPasswordRequestDetails.status = "CLOSED";

        try {
          const updateRequestStatus = await resetPasswordRequestDetails.save();
          if (updateRequestStatus) {
            /*
    
                            Incomplete - Notify User Via Email & SMS Logic Here
    
                        */
            return res.status(STATUS.SUCCESS).json({
              message: "Reset Password Request Processed Successfully.",
              data: {
                request_id: updateRequestStatus.id,
              },
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
        /*
    
                    Incomplete - Notify User Via Email & SMS Logic Here

                */
        return res.status(STATUS.SUCCESS).json({
          message: "Reset Password Request Processed Successfully.",
          data: {
            user_id: userDetails.id,
          },
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
};

module.exports.withdrawResetPasswordRequest = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  if (!req.params.id) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Request ID is Required.`,
    });
  }

  let requestDetails = null;
  let requesterDetails = null;

  try {
    const requestDetailsHandler = await ResetPasswordRequest.findById(
      req.params.id
    );
    if (requestDetailsHandler) {
      if (requestDetailsHandler.status === "CLOSED") {
        return res.status(STATUS.FORBIDDEN).json({
          message: "Request has been already closed.",
        });
      } else {
        requestDetails = requestDetailsHandler;
      }
    } else {
      return res.status(STATUS.NOT_FOUND).json({
        message: "Request not found",
      });
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  try {
    const requesterDetailsHandler = await User.findById(requestDetails.user, {
      is_archived: false,
    });
    if (!requesterDetailsHandler) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (requesterDetailsHandler.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      } else {
        requesterDetails = requesterDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  if (requesterDetails.role === "SUPER_ADMIN") {
    return res.status(STATUS.UNAUTHORISED).json({
      message: MESSAGE.unauthorized,
    });
  } else {
    const activity_data = {
      activity_type: "WITHDRAWN",
      activity_by: "REQUESTER",
      user: requesterDetails.id,
      remarks: req.body.remarks,
    };

    let request_activities = requestDetails.activities;
    request_activities.push(activity_data);

    requestDetails.activities = request_activities;
    requestDetails.status = "CLOSED";

    try {
      const savedRequest = await requestDetails.save();
      if (savedRequest) {
        /*

                    Incomplete - Notify User Via Email & SMS Logic Here

                */
        return res.status(STATUS.SUCCESS).json({
          message: "Reset Password Request Withdrawn Successfully.",
          data: {
            request_id: requestDetails.id,
          },
        });
      }
    } catch (error) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: MESSAGE.internalServerError,
        error,
      });
    }
  }
};

module.exports.resendRequestOTP = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.VALIDATION_FAILED).json({
      message: `Bad request`,
    });
  }

  let requestDetails = null;
  let requesterDetails = null;

  try {
    const requestDetailsHandler = await ResetPasswordRequest.findById(
      req.params.id
    );
    if (requestDetailsHandler) {
      if (requestDetailsHandler.status === "CLOSED") {
        return res.status(STATUS.FORBIDDEN).json({
          message: "Request has been already closed.",
        });
      } else {
        requestDetails = requestDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  try {
    const requesterDetailsHandler = await User.findById(requestDetails.user, {
      is_archived: false,
    });
    if (!requesterDetailsHandler) {
      return res.status(STATUS.NOT_FOUND).json({
        message: "User not found",
      });
    } else {
      if (requesterDetailsHandler.is_active === false) {
        return res.status(STATUS.FORBIDDEN).json({
          message: "User has been temporarily disabled",
        });
      } else {
        requesterDetails = requesterDetailsHandler;
      }
    }
  } catch (error) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
      error,
    });
  }

  if (requesterDetails.role === "SUPER_ADMIN") {
    return res.status(STATUS.FORBIDDEN).json({
      message: "You do not have required permissions to perform this action.",
    });
  }

  let activities_count = requestDetails.activities.length;
  let recent_activity = requestDetails.activities[activities_count - 1];

  if (recent_activity != null) {
    if (
      recent_activity !== "REQUESTED" ||
      recent_activity !== "REJECTED" ||
      recent_activity !== "VALIDATION_SUCCESS" ||
      recent_activity !== "WITHDRAWN" ||
      recent_activity !== "SUCCESSFULLY_UPDATED"
    ) {
      const OTP = Math.floor(100000 + Math.random() * 900000);
      const timestamp = new Date();

      const activity_data = {
        activity_type: "REQUESTED_NEW_OTP",
        activity_by: "REQUESTER",
        user: requesterDetails.id,
        validation_data: {
          otp: OTP,
          timestamp: timestamp,
          is_validated: false,
        },
      };

      let request_activities = requestDetails.activities;
      request_activities.push(activity_data);

      requestDetails.activities = request_activities;

      try {
        const savedRequest = await requestDetails.save();
        if (savedRequest) {
          /*

                        Incomplete - Add Send OTP Via Email & SMS Logic Here

                    */
          console.log(OTP);
          return res.status(STATUS.SUCCESS).json({
            message: "OTP Resent Successfully.",
            data: {
              request_id: requestDetails.id,
            },
          });
        }
      } catch (error) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: MESSAGE.internalServerError,
          error,
        });
      }
    } else {
      return res.status(STATUS.FORBIDDEN).json({
        message: "Unable to process to the request at this moment.",
      });
    }
  } else {
    return res.status(STATUS.BAD_REQUEST).json({
      message: MESSAGE.internalServerError,
    });
  }
};
