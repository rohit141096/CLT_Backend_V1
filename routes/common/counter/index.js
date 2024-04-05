const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../../../authentication/is-auth");
const counterController = require("../../../controllers/common/counter");

router.post(
  "/",
  [body("entity").not().isEmpty(), body("token").not().isEmpty()],
  counterController.updateCounter
);

router.get("/", counterController.getThisEntityCounter);

module.exports = router;
