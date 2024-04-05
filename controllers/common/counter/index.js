const STATUS = require("../../../utils/statusCodes");
const MESSAGE = require("../../../utils/messages");

const Counter = require("../../../models/common/Counter");
const { validationResult } = require("express-validator");

const JWT_SECRET = process.env.CMS_OWNER_JWT_SECRET;

module.exports.updateCounter = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  if (req.body.token != JWT_SECRET) {
    return res.status(STATUS.BAD_REQUEST).json({
      message: `Bad request`,
    });
  }

  const entity = req.body.entity.toUpperCase();

  try {
    let counter = await Counter.findOne({ entity: entity });

    if (counter) {
      counter.count = counter.count + 1;

      try {
        const savedCounter = await counter.save();

        return res.status(STATUS.SUCCESS).json({
          message: MESSAGE.itemUpdated,
          count: savedCounter.count,
        });
      } catch (error) {
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
          message: MESSAGE.internalServerError,
          error: error,
        });
      }
    } else {
      const newCounter = new Counter({
        entity: entity,
        count: 1,
      });

      try {
        const savedCounter = await newCounter.save();

        return res.status(STATUS.SUCCESS).json({
          message: MESSAGE.itemUpdated,
          count: savedCounter.count,
        });
      } catch (error) {
        return res.status(STATUS.BAD_REQUEST).json({
          message: "Invalid Entity Type",
          error: MESSAGE.badRequest,
        });
      }
    }
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
      error: error,
    });
  }
};

module.exports.getThisEntityCounter = async (req, res) => {
  const entity = req.query.entity.toUpperCase();
  try {
    const counter = await Counter.findOne({ entity: entity });
    if (counter) {
      return res.status(STATUS.SUCCESS).json({
        count: counter.count,
        message: "Count Found",
      });
    } else {
      return res.status(STATUS.SUCCESS).json({
        count: 0,
        message: "Count Empty",
      });
    }
  } catch (error) {
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      message: MESSAGE.internalServerError,
    });
  }
};
