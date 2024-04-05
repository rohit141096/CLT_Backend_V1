const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const resetPasswordController = require("../../controllers/resetPasswordRequest");

router.post(
  "/request",
  [body("email_id").trim().not().isEmpty()],
  resetPasswordController.requestResetPasswordPreLogin
);

router.patch(
  "/update/:id",
  isAuth,
  [
    body("approver_id").trim().not().isEmpty(),
    body("status").trim().not().isEmpty(),
  ],
  resetPasswordController.updateResetPasswordRequestStatus
);

router.patch(
  "/withdraw/:id",
  resetPasswordController.withdrawResetPasswordRequest
);

router.patch(
  "/change/:id",
  [
    body("new_password").trim().not().isEmpty(),
    body("repeat_password").trim().not().isEmpty(),
  ],
  resetPasswordController.resetUserPassword
);

router.patch("/resend/otp/:id", resetPasswordController.resendRequestOTP);

router.get("/:id", resetPasswordController.getThisResetPasswordRequest);

module.exports = router;
