const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const FILE_PATH = process.env.STORAGE_PATH || "./uploads"
const fs = require('fs/promises');

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

//start app 
const port = process.env.PORT || 9090;

app.get('/collections', async (req, res) => {
    try {
        let dirs = await fs.readdir(`${FILE_PATH}/`, { withFileTypes: true })
        res.json( { "dirs": dirs })
    } catch {
        res.status(404).json(null)
    }
})

app.get('/collections/:collectionId', async (req, res) => {
    const { collectionId } = req.params
    try {
        let dirs = await fs.readdir(`${FILE_PATH}/${collectionId}`, { withFileTypes: true })
        res.json({ "result": dirs })
    } catch (err) {
        res.status(404).json( { err } )
    }
    
})

app.get('/collections/:collectionId/:fileId', async (req, res) => {
    const { collectionId, fileId } = req.params
    try {
        let file = await fs.readFile(`${FILE_PATH}/${collectionId}/${fileId}`)
        res.send(file)
    } catch {
        res.status(404).send(null)
    }
})

app.post('/upload-photos/:collectionId', async (req, res) => {
    let { collectionId } = req.params
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let data = []; 
    
            //loop all files
            _.forEach(_.keysIn(req.files.photos), (key) => {
                let photo = req.files.photos[key];
                
                //move photo to uploads directory
                photo.mv(`${FILE_PATH}/${collectionId}/` + photo.name);

                //push file details
                data.push({
                    name: photo.name,
                    mimetype: photo.mimetype,
                    size: photo.size
                });
            });
    
            //return response
            res.send({
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

app.listen(port, () => 
  console.log(`App is listening on port ${port}.`)
);

app.use(express.static('/data-volume/*/*'));