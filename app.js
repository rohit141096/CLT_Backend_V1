const express = require("express");
const app = express();

require("dotenv").config();

const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");

const statusCodes = require("./utils/statusCodes");

app.use(cors());

app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_ROOT = process.env.CLT_API_BASE_PATH;

app.use(`${API_ROOT}assets`, express.static(path.join(__dirname, "assets")));
app.disable("etag");

const counterRoutes = require("./routes/common/counter");

const userRoutes = require("./routes/user");
const resetPasswordRoutes = require("./routes/resetPasswordRequest");

app.use(`${API_ROOT}counter`, counterRoutes);
app.use(`${API_ROOT}user`, userRoutes);
app.use(`${API_ROOT}reset-password`, resetPasswordRoutes);

app.get(`${API_ROOT}`, async (req, res, next) => {
  return res.status(statusCodes.SUCCESS).send("Welcome!");
});

try {
  const DB_URL = process.env.CLT_DB_URL;
  const PORT = process.env.PORT;

  const dbConnection = mongoose.connect(DB_URL);
  if (dbConnection) {
    app.listen(PORT, () => console.log("DB Connection Successfull"));
  } else {
    console.log("Error in connecting to DB");
  }
} catch (error) {
  console.log("Error in connecting to DB:", error);
}
