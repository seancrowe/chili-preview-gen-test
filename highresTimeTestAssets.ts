import { ChiliConnector } from "@seancrowe/chiliconnector-v1_2";
import fs from "fs/promises";
import path from "path";
import { nanoid } from 'nanoid';

const noAutomaticPreviewForNewItems = true;
const assetsToTest = 1;
const downloadPreviewFiles = true;

const config = JSON.parse(await (await fs.open("./config.json")).readFile("utf8"));

const assets = await fs.readdir("./assets");

if (assets.length == 0) {
  throw Error("no assets found in ./assets/ folder");
}

function getRandomAsset(assets: string[]) {
  const randomIndex = Math.floor(Math.random() * assets.length);
  return assets[randomIndex];
}

const { username, password, baseUrl, environment } = config;

if (typeof username != "string") throw Error("username is not a string")
if (typeof password != "string") throw Error("password is not a string")
if (typeof baseUrl != "string") throw Error("baseUrl is not a string")
if (typeof environment != "string") throw Error("environment is not a string")

const connector = new ChiliConnector(baseUrl);
const apiKeyRes = await connector.api.generateApiKeyWithSettings(
  {
    userName: username,
    password: password,
    settingsXML: `<settings><item name='noAutomaticPreviewForNewItems' value='${noAutomaticPreviewForNewItems}' /></settings>`,
    environmentNameOrURL: environment
  });

const apiKeyResJson = await apiKeyRes.json();

if (apiKeyResJson.key == null) {
  console.log(apiKeyResJson);
  throw Error(`Error generating API key`);
}

connector.apiKey = apiKeyResJson.key;

console.log("uploading assets");


const donePreviews = [];
const addToPreviewTime = [];
const addToPreviewDetails = [];

for (var i = 0; i < assetsToTest; i++) {

  const startTime = process.hrtime.bigint();

  const randomAsset = getRandomAsset(assets);

  const assetBase64 = await fs.readFile(`./assets/${randomAsset}`, "base64");

  await fs.writeFile("./base64", assetBase64);

  const assetRes = await connector.api.resourceItemAdd({
    xml: "",
    fileData: assetBase64,
    newName: nanoid() + path.extname(randomAsset),
    folderPath: "00 Support Preview Test",
    resourceName: "Assets"
  });

  const uploadDone = process.hrtime.bigint();

  const assetId = (await assetRes.json()).id;

  donePreviews.push(await connector.api.downloadAssets({
    id: assetId,
    resourceType: "Assets",
    type: "highest",
    async: false
  }));

  const endTime = process.hrtime.bigint();
  const timeDiff = (endTime - startTime) / BigInt(1000000);

  addToPreviewTime.push(timeDiff);

  addToPreviewDetails.push({
    uploadTime: (uploadDone - startTime) / BigInt(1000000),
    previewTime: (endTime - uploadDone) / BigInt(1000000),
    totalTime: timeDiff
  })

  await new Promise(res => setTimeout(res, 8000))
}

await fs.writeFile("previewTimings.json", JSON.stringify(addToPreviewDetails, (key, value) =>
  typeof value === 'bigint'
    ? value.toString()
    : value
  , 4));

// Calculating the maximum time
const maxTime = addToPreviewTime.reduce((max, current) => current > max ? current : max, addToPreviewTime[0]);

// Calculating the average time
const sumTime = addToPreviewTime.reduce((sum, current) => sum + current, BigInt(0));
const averageTime = sumTime / BigInt(addToPreviewTime.length);

console.log(`Average Time from Upload to Preview: ${averageTime} ms`);
console.log(`Max Time ${maxTime} ms`);

if (downloadPreviewFiles) {

  console.log("downloading files");

  const downloadStartTime = process.hrtime.bigint();

  for (var previewRes of donePreviews) {
    const buffer = await previewRes.arrayBuffer();
    await fs.writeFile(`./previews/${nanoid()}.png`, Buffer.from(buffer))
  }

  const endTime = process.hrtime.bigint();

  const downloadTimeDiff = (endTime - downloadStartTime) / BigInt(1000000);

  console.log(`Total Time Download Previews: ${downloadTimeDiff} ms`);
}
