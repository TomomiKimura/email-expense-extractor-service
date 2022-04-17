import "dotenv/config";
import { FetchMessageObject, ImapFlow } from "imapflow";
import QuotedPrintable from "@vlasky/quoted-printable";

function readEnvironmentVariables(): {
  IMAP_USERNAME: string;
  IMAP_PASSWORD: string;
} {
  // FIXME: Add proper validation with zod
  if (process.env.IMAP_USERNAME === undefined || process.env.IMAP_PASSWORD === undefined) {
    throw new Error("You didn't configure your environment properly");
  }

  return {
    IMAP_USERNAME: process.env.IMAP_USERNAME,
    IMAP_PASSWORD: process.env.IMAP_PASSWORD,
  };
}

const env = readEnvironmentVariables();

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: env.IMAP_USERNAME,
    pass: env.IMAP_PASSWORD,
  },
  logger: false,
});

type Email = {
  date: Date;
  from: string;
  subject: string;
  body: string;
};

function parseEmail(message: FetchMessageObject): Email | undefined {
  const date = message.envelope.date;
  const from = message.envelope.from[0].address;
  const subject = message.envelope.subject;
  const rawBody = message.bodyParts.get("2");

  if (from === undefined) {
    console.log(`The message '${message.uid}' doesn't contain an address for 'from'`);
    return;
  }

  if (rawBody === undefined) {
    console.log(`Received an email '${message.uid}' that doesn't have a part '2'`);
    return;
  }

  let body: string;
  try {
    body = decodeBody(rawBody);
  } catch (e: unknown) {
    console.log(`Couldn't decode email body form message '${message.uid}'`);
    return;
  }

  return {
    date,
    from,
    subject,
    body,
  };
}

function decodeBody(body: Buffer): string {
  return QuotedPrintable.decode(body, { qEncoding: false }).toString();
}

async function processNewEmails() {
  // Select and lock a mailbox. Throws if mailbox does not exist
  let lock = await client.getMailboxLock("INBOX");
  try {
    if (typeof client.mailbox === "boolean") {
      throw new Error("The mailbox doesn't exist");
    }

    // FIXME: Define the range based on the latest email processed by the previous batch
    for await (let message of client.fetch("1:*", { envelope: true, bodyParts: ["1", "2"], source: true })) {
      const email = parseEmail(message);
      if (email === undefined) continue;

      // FIXME: Figure out if the email was sent from a bank/payment provider (Merpay)
      // FIXME: Depending on the provider, parse the email body to retrieve transaction information
      // FIXME: Store transaction data on DB

      console.log(`- ${email.subject}`);
    }
  } finally {
    // Make sure lock is released, otherwise next `getMailboxLock()` never returns
    lock.release();
  }
}

const main = async () => {
  // Wait until client connects and authorizes
  await client.connect();

  // FIXME: Process new emails every X amount of time
  await processNewEmails();

  // log out and close connection
  await client.logout();
};

main().catch((err) => console.error(err));
