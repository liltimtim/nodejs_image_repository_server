const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const _ = require("lodash");
const FILE_PATH = process.env.STORAGE_PATH || "./uploads";
const MUSIC_FILE_PATH = process.env.MUSIC_STORAGE_PATH || "./uploads-music";
const fs = require("fs/promises");

const app = express();
const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");
const LOGGER_URL = process.env.LOGGER_URL || "http://logger.home.localnet:3100";
const promBundle = require("express-prom-bundle");

const logger = createLogger();
logger.add(
  new transports.Console({
    format: format.json(),
    level: "debug",
  })
);

logger.add(
  new LokiTransport({
    host: LOGGER_URL,
    json: true,
    labels: { job: "image-uploader-logs" },
  })
);

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: {
    project_name: "zenpic_api",
    project_type: "zenpic_metric_labels",
  },
  promClient: {
    collectDefaultMetrics: {},
  },
});

app.use(metricsMiddleware);

// enable files upload
app.use(
  fileUpload({
    createParentPath: true,
    safeFileNames: true,
  })
);

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));

//start app
const port = process.env.PORT || 9090;

app.get("/collections", async (req, res) => {
  try {
    let dirs = await getDirs(FILE_PATH);
    logger.info(`collections query ${FILE_PATH} client: ${req.ip}`);
    logger.info(req.hostname);
    res.json({ dirs: dirs });
  } catch (err) {
    logError(err);
    res.status(404).json(null);
  }
});

app.get("/collections-music", async (req, res) => {
  try {
    let dirs = await getDirs(MUSIC_FILE_PATH);
    logger.info(`collections query ${MUSIC_FILE_PATH} client: ${req.ip}`);
    logger.info(req.hostname);
    res.json({ dirs: dirs });
  } catch (err) {
    logError(err);
    res.status(404).json(null);
  }
});

app.get("/weathercollections", async (req, res) => {
  try {
    const { condition } = req.query;
    if (!condition) {
      throw Error("Query parameter condition required.");
    }
    var dirs = {};
    var foundCollection = "";
    switch (condition) {
      case "sun":
        foundCollection = "Sunny Day";
        break;
      case "cloud":
        foundCollection = "Cloudy Day";
        break;
      case "rain":
        foundCollection = "Rainy Day";
        break;
      case "snow":
        foundCollection = "Snow Day";
        break;
      default:
        throw Error(`Query condition '${condition}' does not exist`);
    }
    dirs = await fs.readdir(`${FILE_PATH}/${foundCollection}`, {
      withFileTypes: true,
    });
    console.log({ result: dirs, collection: foundCollection });
    return res.json({ result: dirs, collection: foundCollection });
  } catch (err) {
    logError(err);
    res.status(404).json({ error: err.message });
  }
});

app.get("/collections/:collectionId", async (req, res) => {
  const { collectionId } = req.params;
  try {
    let dirs = await getDirsCollection(FILE_PATH, collectionId);
    res.json({ result: dirs });
  } catch (err) {
    logError(err);
    res.status(404).json({ err });
  }
});

app.get("/collections-music/:collectionId", async (req, res) => {
  const { collectionId } = req.params;
  try {
    let dirs = await getDirsCollection(MUSIC_FILE_PATH, collectionId);
    res.json({ result: dirs });
  } catch (err) {
    logError(err);
    res.status(404).json({ err });
  }
});

async function getDirsCollection(path, collectionId) {
  return await fs.readdir(`${path}/${collectionId}`, {
    withFileTypes: true,
  });
}

async function getDirs(path) {
  return await fs.readdir(`${path}`, { withFileTypes: true });
}

app.get("/collections/:collectionId/:fileId", async (req, res) => {
  const { collectionId, fileId } = req.params;
  try {
    let file = await fs.readFile(`${FILE_PATH}/${collectionId}/${fileId}`);
    res.send(file);
  } catch {
    res.status(404).send(null);
  }
});

app.get("/collections-music/:collectionId/:fileId", async (req, res) => {
  const { collectionId, fileId } = req.params;
  try {
    let file = await fs.readFile(
      `${MUSIC_FILE_PATH}/${collectionId}/${fileId}`
    );
    res.send(file);
  } catch {
    res.status(404).send(null);
  }
});

/**
 *
 * @param {Error} err
 */
function logError(err) {
  logger.error(JSON.stringify(err));
  logger.error(`error: ${err.name} || message: ${err.message}`);
}

app.post("/upload-photos/:collectionId", async (req, res) => {
  let { collectionId } = req.params;
  try {
    if (!req.files) {
      res.send({
        status: false,
        message: "No file uploaded",
      });
    } else {
      let data = uploadFile(collectionId, req.files, FILE_PATH);

      //return response
      res.send({
        status: true,
        message: "Files are uploaded",
        data: data,
      });
    }
  } catch (err) {
    console.log(err);
    logError(err);
    res.status(500).send(err);
  }
});

app.post("/upload-music/:collectionId", async (req, res) => {
  let { collectionId } = req.params;
  try {
    if (!req.files) {
      return res.send({
        status: false,
        message: "no files uploaded",
      });
    }
    let data = uploadFile(collectionId, req.files, MUSIC_FILE_PATH);
    res.send({
      status: true,
      message: "Files are uploaded",
      data: data,
    });
  } catch (err) {
    console.log(err);
    logError(err);
    res.status(500).send(err);
  }
});

function uploadFile(collectionId, files, filePath) {
  console.log("Attempting file upload");
  if (!files) {
    throw new Error("No file uploaded");
  }
  let data = [];
  // when multiple files come in they come in as an array
  if (_.isArray(files.files)) {
    _.forEach(_.keysIn(files.files), (key) => {
      console.log(`uploading ${key}`);
      console.log(`=== moving file to directory ${filePath}/${collectionId}/`);
      let f = files.files[key];
      console.log(files.files);
      f.mv(`${filePath}/${collectionId}/` + f.name);
      data.push({
        name: f.name,
        mimetype: f.mimetype,
        size: f.size,
      });
    });
    return data;
  }
  // support uploading single object as well
  if (_.isObject(files.files)) {
    console.log("is single object");
    let f = files.files;
    console.log(`=== moving file to directory ${filePath}/${collectionId}/`);
    f.mv(`${filePath}/${collectionId}/` + f.name);
    data.push({
      name: f.name,
      mimetype: f.mimetype,
      size: f.size,
    });
    return data;
  }
  return data;
}

app.listen(port, () => {
  console.log(`App is listening on port ${port}.`);
  logger.info(`Application started on port ${port}`);
});

app.use(express.static("/data-volume/*/*"));
