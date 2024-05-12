import { ChiliConnector } from "@seancrowe/chiliconnector-v1_2";
import fs from "fs/promises";
import { nanoid } from 'nanoid';

const noAutomaticPreviewForNewItems = true;
const docsToTest = 96;
const downloadPreviewFiles = true;

const config = JSON.parse(await (await fs.open("./config.json")).readFile("utf8"));

const docs = await fs.readdir("./docs");

if (docs.length == 0) {
  throw Error("no docs found in ./docs/ folder");
}

function getRandomDoc(docs: string[]) {
  const randomIndex = Math.floor(Math.random() * docs.length);
  return docs[randomIndex];
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

console.log("uploading docs");


const donePreviews = [];
const addToPreviewTime = [];

for (var i = 0; i < docsToTest; i++) {

  const startTime = process.hrtime.bigint();

  const docXml = await fs.readFile(`./docs/${getRandomDoc(docs)}`, "utf8");

  const docRes = await connector.api.resourceItemAdd({
    xml: docXml,
    fileData: "",
    newName: nanoid(),
    folderPath: "00 Support Preview Test",
    resourceName: "Documents"
  });

  const docId = (await docRes.json()).id;

  donePreviews.push(await connector.api.downloadAssets({
    docId,
    page: 1,
    resourceType: "Documents",
    type: "highest"
  }));

  const endTime = process.hrtime.bigint();
  const timeDiff = (endTime - startTime) / BigInt(1000000);

  addToPreviewTime.push(timeDiff);
}

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
