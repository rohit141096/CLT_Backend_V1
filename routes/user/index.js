const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../authentication/is-auth");
const userController = require("../../controllers/user");

router.post(
  "/register-token",
  [
    body("first_name").not().isEmpty(),
    body("last_name").not().isEmpty(),
    body("email_id").not().isEmpty(),
    body("password").not().isEmpty(),
    body("phone_number").not().isEmpty(),
  ],
  userController.registerUserWithoutToken
);

router.post(
  "/login",
  [
    body("email_id").trim().not().isEmpty(),
    body("password").trim().not().isEmpty(),
  ],
  userController.loginUser
);

router.post(
  "/validate/email",
  isAuth,
  [
    body("user_id").trim().not().isEmpty(),
    body("otp").trim().not().isEmpty().isInt().isLength({ min: 6, max: 6 }),
  ],
  userController.validateUserEmailID
);

router.post(
  "/validate/phone",
  isAuth,
  [
    body("user_id").trim().not().isEmpty(),
    body("otp").trim().not().isEmpty().isInt().isLength({ min: 6, max: 6 }),
  ],
  userController.validateUserPhoneNo
);

router.post(
  "/validate/2fa",
  isAuth,
  [
    body("user_id").trim().not().isEmpty(),
    body("otp").trim().not().isEmpty().isInt().isLength({ min: 6, max: 6 }),
    body("ip_address").trim().not().isEmpty(),
  ],
  userController.checkUser2FAOTPValidity
);

router.get("/enable/2fa/:id", isAuth, userController.getUserQrCodeToEnable2FA);

router.patch(
  "/validate/reset/password",
  [
    body("request_id").trim().not().isEmpty(),
    body("user_id").trim().not().isEmpty(),
    body("otp").trim().not().isEmpty().isInt().isLength({ min: 6, max: 6 }),
  ],
  userController.validateUserForgotPasswordOTP
);

router.get(
  "/super-admin/auth/all",
  isAuth,
  userController.getAllAuthUsersWithoutPagination
);

module.exports = router;
