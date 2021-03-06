import { initializeJPEG2000 } from './decoders/decodeJPEG2000.js';
import { initializeJPEGLS } from './decoders/decodeJPEGLS.js';
import getMinMax from './getMinMax.js';
import decodeImageFrame from './decodeImageFrame.js';

// flag to ensure codecs are loaded only once
let codecsLoaded = false;

// the configuration object for the decodeTask
let decodeConfig;

/**
 * Function to control loading and initializing the codecs
 * @param config
 */
function loadCodecs (config) {
  // prevent loading codecs more than once
  if (codecsLoaded) {
    return;
  }

  // Load the codecs
  // console.time('loadCodecs');
  self.importScripts(config.decodeTask.codecsPath);
  codecsLoaded = true;
  // console.timeEnd('loadCodecs');

  // Initialize the codecs
  if (config.decodeTask.initializeCodecsOnStartup) {
    // console.time('initializeCodecs');
    initializeJPEG2000(config.decodeTask);
    initializeJPEGLS(config.decodeTask);
    // console.timeEnd('initializeCodecs');
  }
}

/**
 * Task initialization function
 */
function decodeTaskInitialize (config) {
  decodeConfig = config;
  if (config.decodeTask.loadCodecsOnStartup) {
    loadCodecs(config);
  }
}

function calculateMinMax (imageFrame) {
  const minMax = getMinMax(imageFrame.pixelData);

  if (decodeConfig.decodeTask.strict === true) {
    if (imageFrame.smallestPixelValue !== minMax.min) {
      console.warn('Image smallestPixelValue tag is incorrect. Rendering performance will suffer considerably.');
    }

    if (imageFrame.largestPixelValue !== minMax.max) {
      console.warn('Image largestPixelValue tag is incorrect. Rendering performance will suffer considerably.');
    }
  } else {
    imageFrame.smallestPixelValue = minMax.min;
    imageFrame.largestPixelValue = minMax.max;
  }
}

/**
 * Task handler function
 */
function decodeTaskHandler (data, doneCallback) {
  // Load the codecs if they aren't already loaded
  loadCodecs(decodeConfig);

  const imageFrame = data.data.imageFrame;

  // convert pixel data from ArrayBuffer to Uint8Array since web workers support passing ArrayBuffers but
  // not typed arrays
  const pixelData = new Uint8Array(data.data.pixelData);

  decodeImageFrame(
    imageFrame,
    data.data.transferSyntax,
    pixelData,
    decodeConfig.decodeTask,
    data.data.options);

  calculateMinMax(imageFrame);

  // convert from TypedArray to ArrayBuffer since web workers support passing ArrayBuffers but not
  // typed arrays
  imageFrame.pixelData = imageFrame.pixelData.buffer;

  // invoke the callback with our result and pass the pixelData in the transferList to move it to
  // UI thread without making a copy
  doneCallback(imageFrame, [imageFrame.pixelData]);
}

export default {
  taskType: 'decodeTask',
  handler: decodeTaskHandler,
  initialize: decodeTaskInitialize
};
