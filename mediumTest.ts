
import { ChiliConnector } from "@seancrowe/chiliconnector-v1_2";
import fs from "fs/promises";
import { nanoid } from 'nanoid';

const noAutomaticPreviewForNewItems = true;

async function getTaskList(connector: ChiliConnector) {
  const tasksListRes = await connector.api.tasksGetList({
    includeRunningTasks: true, includeWaitingTasks: true, includeFinishedTasks: true
  });

  type taskMini = { id: string, itemID: string, identifier: string };

  const tasksListResJson = await tasksListRes.json();

  if (tasksListResJson.item == null) throw Error("Getting task list went wrong");

  return tasksListResJson.item as taskMini[];

}

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

const tasksSnapshot = await getTaskList(connector);

console.log("testing noAutomaticPreviewForNewItems settings");


const docsUploaded = []

for (var i = 0; i < 20; i++) {

  const docXml = await fs.readFile(`./docs/${getRandomDoc(docs)}`, "utf8");

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

await new Promise(res => setTimeout(res, 10000));

const tasksSnapshot2 = await getTaskList(connector);

const snapshotDiff = tasksSnapshot2.filter(task => tasksSnapshot.find(t => t.id == task.id) == null);

const tasksFoundForNewDocs = snapshotDiff.filter(task => newDocsIds.find(i => i == task.itemID));

console.log(`Tasks found for our new documents ${tasksFoundForNewDocs.length}`);
console.log(`Medium preview related tasks: ${tasksFoundForNewDocs.filter(task => task.identifier.includes("edium")).length}`);
