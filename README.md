# Image Server

Serves images for ZenPic on tvOS

## Endpoints

### Collections

Routes

`GET - /collections`

Returns all the collections the application has

`GET - /weathercollections`

Given URL condition query : `sun, cloud, rain, or snow` will return the appropriate image collection for the weather condition.

`GET - /collections/:collectionId`

Returns all images contained in the collection by its `collectionId`

`GET - /collections/:collectionId/:fileId`

Returns the specified image by its ID. This is the image file.
