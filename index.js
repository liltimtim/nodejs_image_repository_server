const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const _ = require("lodash");
const FILE_PATH = process.env.STORAGE_PATH || "./uploads";
const fs = require("fs/promises");
const sharp = require("sharp");
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
    let dirs = await fs.readdir(`${FILE_PATH}/`, { withFileTypes: true });
    logger.info(`collections query ${FILE_PATH} client: ${req.ip}`);
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
    let dirs = await fs.readdir(`${FILE_PATH}/${collectionId}`, {
      withFileTypes: true,
    });
    res.json({ result: dirs });
  } catch (err) {
    logError(err);
    res.status(404).json({ err });
  }
});

app.get("/collections/:collectionId/:fileId", async (req, res) => {
  const { collectionId, fileId } = req.params;
  try {
    let file = await fs.readFile(`${FILE_PATH}/${collectionId}/${fileId}`);
    const { width, height } = req.query;
    // check to see if query params height and width are given
    if (width != null && height != null) {
      try {
        let resizedImage = await resizeImage(file, width, height);
        res.send(resizedImage);
      } catch (error) {
        res.status(500).json({ error });
      }
    } else {
      res.send(file);
    }
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

/**
 *
 * @param {Buffer} image
 * @param {Number} width
 * @param {Number} height
 * @returns
 */
async function resizeImage(image, width, height) {
  try {
    return await sharp(image)
      .resize({
        width: Number(width),
        height: Number(height),
        fit: "inside",
      })
      .toBuffer();
  } catch (error) {
    throw error;
  }
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
      let data = [];

      //loop all files
      _.forEach(_.keysIn(req.files.photos), (key) => {
        console.log(`uploading ${key}`);
        let photo = req.files.photos[key];
        console.log(req.files.photos);
        //move photo to uploads directory
        photo.mv(`${FILE_PATH}/${collectionId}/` + photo.name);

        //push file details
        data.push({
          name: photo.name,
          mimetype: photo.mimetype,
          size: photo.size,
        });
      });

      //return response
      res.send({
        status: true,
        message: "Files are uploaded",
        data: data,
      });
    }
  } catch (err) {
    logError(err);
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}.`);
  logger.info(`Application started on port ${port}`);
});

app.use(express.static("/data-volume/*/*"));
