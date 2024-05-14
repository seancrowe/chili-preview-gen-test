
import { ChiliConnector } from "@seancrowe/chiliconnector-v1_2";
import fs from "fs/promises";
import { nanoid } from 'nanoid';

const noAutomaticPreviewForNewItems = true;
const docsToTest = 96;
const savedInEditor = false;
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

const uploadDocTime = process.hrtime.bigint();

const docsUploaded = []

for (var i = 0; i < docsToTest; i++) {

  const docXmlOrg = await fs.readFile(`./docs/${getRandomDoc(docs)}`, "utf8");

  const docXml = docXmlOrg.replace(
    (savedInEditor ? "savedInEditor=\"false\"" : "savedInEditor=\"true\""),
    (savedInEditor ? "savedInEditor=\"true\"" : "savedInEditor=\"false\""))

  docsUploaded.push(connector.api.resourceItemAdd({
    xml: docXml,
    fileData: "",
    newName: nanoid(),
    folderPath: "00 Support Preview Test",
    resourceName: "Documents"
  }));

}

const newDocsJson = (await Promise.all(docsUploaded)).map(res => res.json());
const newDocsIds = (await Promise.all(newDocsJson)).map(json => json.id);

console.log("requesting previews");

const requestPreviewsTime = process.hrtime.bigint();

const allPreviewReq = newDocsIds.map(id => connector.api.downloadAssets({
  id,
  page: 1,
  resourceType: "Documents",
  type: "highest"
}));

const donePreviews = await Promise.all(allPreviewReq);

const endTime = process.hrtime.bigint();

const totalTimeDiff = (endTime - uploadDocTime) / BigInt(1000000);
const previewTimeDiff = (endTime - requestPreviewsTime) / BigInt(1000000);

console.log(`Total Time: ${totalTimeDiff} ms`);
console.log(`Preview Time ${previewTimeDiff} ms`);
console.log(`Calculated ratio ${previewTimeDiff / BigInt(docsToTest)} ms per doc`);

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
