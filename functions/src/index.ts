import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import request from "request";

interface FetchResponse {
  code: number;
  status: number;
  data: {
    content: string;
    title: string;
    url: string;
  };
}

admin.initializeApp();
const db = admin.firestore();

const websites = ["https://asuracomic.net/"];
const titles = ["Murim Login", "Solo Leveling"];

export const checkMangaUpdates = functions.https.onRequest(async (req, res) => {
  try {
    for (const website of websites) {
      const scrapedContent = await fetchContent(website);
      console.log({ scrapedContent });

      for (const title of titles) {
        const latestChapter = extractLatestChapter(scrapedContent, title);

        if (latestChapter) {
          const docRef = db
            .collection("mangaUpdates")
            .doc(`${sanitize(title)}-${sanitize(website)}`);
          const doc = await docRef.get();

          if (!doc.exists || doc.data()?.latestChapter !== latestChapter) {
            await docRef.set({
              title,
              latestChapter,
              website,
              checkedAt: new Date().toISOString(),
            });
            console.log(`Updated: ${title} ${website} ch ${latestChapter}`);
          } else {
            console.log(`${title} on ${website} is already up-to-date.`);
          }
        } else {
          console.log(`Title not found: ${title} on ${website}`);
        }
      }
    }
    res.status(200).send("Updates checked");
  } catch (error) {
    console.error("Error checking manga updates:", error);
    res.status(500).send("An error occurred while checking manga updates.");
  }
});

async function fetchContent(website: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://r.jina.ai/${website}`;
    request(
      url,
      { json: true },
      (error: Error | null, res: request.Response, body: FetchResponse) => {
        if (error) {
          console.error(`Error fetching content from ${website}:`, error);
          return reject(new Error("Failed to fetch content"));
        }
        if (body && body.data.content) {
          resolve(body.data.content);
        } else {
          resolve("");
        }
      }
    );
  });
}

function extractLatestChapter(content: string, title: string): string | null {
  const regex = new RegExp(`${title}.*Chapter\\s(\\d+)`, "i");
  const matches = content.match(regex);

  if (matches && matches[1]) {
    return matches[1];
  }
  return null;
}

function sanitize(input: string): string {
  return input.replace(/[/\\]/g, "").trim();
}
