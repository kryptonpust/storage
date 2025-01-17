const { join: joinPaths } = require('path');
const { Router } = require('express');
const multer = require('multer');
const { extname } = require('path');
const { v4: generateUuid } = require('uuid');
const exec = require('@appgeist/exec');
const ensureDir = require('@appgeist/ensure-dir');
const getFileFromUrl = require('@appgeist/get-file-from-url');

const PICTURE_EXTENSIONS = ['.jpg', '.jpeg', '.gif', '.png', '.webp'];

module.exports = ({ tmpDir, storageDir, maxUploadSize, pictureQuality, maxPicturePixels, useImgMagick ,onUpload }) => {
  const router = Router();

  router.post(
    '*',
    // apply multer middleware
    multer({
      dest: tmpDir,
      limits: { files: 1, fileSize: maxUploadSize }
    }).single('file'),
    // process file upload
    async (req, res, next) => {
      try {
        const {
          file,
          body: { url }
        } = req;

        if (!(file || url)) throw new Error('Must provide file data or url');

        const uuid = generateUuid();

        const path = req.url;
        const originalName = url || file.originalname;
        const tempPath = url ? await getFileFromUrl({ url, file: `${tmpDir}/${uuid}` }) : file.path;
        const ext = extname(originalName).toLowerCase();
        const isPicture = PICTURE_EXTENSIONS.includes(ext);
        const result = { path, uuid, isPicture, originalName, ext };
        const dir = joinPaths(storageDir, path);
        await ensureDir(dir);
        // check if the uploaded file has a known picture extension
        if (useImgMagick && isPicture) {
          // convert uploaded temp picture file to *.webp in files directory

          await exec(`
            convert ${tempPath}
              -strip -quality ${pictureQuality}%
              -resize @${maxPicturePixels}\\>
              ${dir}/${uuid}.webp
          `);
          result.aspectRatio = parseFloat(await exec(`identify -format "%[fx:w/h]" ${dir}/${uuid}.webp`));
          result.ext='.webp';
          // remove uploaded picture file
          exec(`rm ${tempPath}`);
        } else {
          // move uploaded temp file to files directory
          await exec(`mv ${tempPath} ${dir}/${uuid}${ext}`);

        }
        await onUpload(req,res,next,result);

        // res.send(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
};
