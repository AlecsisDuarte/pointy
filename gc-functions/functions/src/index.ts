import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CallableContext } from 'firebase-functions/lib/providers/https';
//import { DocumentSnapshot, QuerySnapshot, DocumentReference } from '@google-cloud/firestore';
import { response } from 'express';
import { QuerySnapshot } from '@google-cloud/firestore';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

admin.initializeApp()

const onError = function (reason: any) {
    console.log(`Error: ${reason}`);
}

const getWord = function (): string {
    return words[Math.floor(Math.random() * words.length)]
}

const getJoinedWords = function (): string {
    return `${getWord()}-${getWord()}`
}

exports.createRoom = functions.https.onCall(async (data: any, context: CallableContext) => {
    if (context.auth === null) {
        console.log(`Got unauthed call in createRoom`, data, context)
        response.status(401).send('Unauthorized')
        return
    }

    console.log(`Got good call in createRoom`, data, context)

    const firestore = admin.firestore()
    const roomsCollection = firestore.collection('rooms')
    const user = context.auth!;
    const roomName = getJoinedWords()
    await roomsCollection.doc(roomName).create({
        'name': roomName,
        'ownerId': user.uid,
        'createdAt': new Date()
    }).catch(onError);

    const writeResult = await firestore.collection(`rooms/${roomName}/users`)
        .doc(user.uid)
        .set({ 'createdAt': new Date(), 'uid': user.uid, name: data.userName })

    console.log("createRoom() Complete!", writeResult);

    return {
        'roomId': roomName
    }
})

exports.joinRoom = functions.https.onCall(async (data: any, context: CallableContext) => {
    if (context.auth === null) {
        console.log(`Got unauthed call in joinRoom`, data, context)
        response.status(401).send('Unauthorized')
        return
    }

    if (!data || !data.roomName) {
        console.log("Got empty roomName", data, context)
        response.status(401).send('Unauthorized')
        return
    }

    const roomName: string = data.roomName;

    console.log(`Got good call in joinRoom`, data, context)

    const firestore = admin.firestore()


    const querySnapshot = await firestore.collection('rooms').where("name", "==", data.roomName).get().catch(onError)

    if (!(querySnapshot instanceof QuerySnapshot)) { 
        console.log('querySnapshot not instanceof QuerySnapshot', querySnapshot);
        return
    }

    const docCount = querySnapshot.docs.length
    console.log(`Found ${docCount} docs for name ${roomName}`)
    if (docCount !== 1) {
        return { success: false, message: `Room ${data.roomName} not found` }
    }
    const roomDoc = await querySnapshot.docs[0].id

    const writeResult = await firestore.collection(`rooms/${roomDoc}/users`).doc(context.auth!.uid).set(
        { createdAt: Date.now(), name: data.userName, uid: context.auth!.uid }
    )

    console.log("joinRoom() Complete!", writeResult);

    return {
        'roomId': roomDoc,
        'roomName': roomName
    }
})

// function isDocumentReference(result: void | DocumentReference): result is DocumentReference {
//     return (<DocumentReference>result).id !== undefined;
// }

// exports.createInvitation = functions.https.onCall(async (data: any, context: CallableContext) => {
//     if (context.auth === null) return;

//     const userId = context.auth!.uid
//     const userDocument = admin.firestore().collection('users').doc(userId)
//     const userPromise = userDocument.get();
//     userPromise.catch(onError)
//     const userObject = await userPromise;

//     const invitation = {
//         householdId: userObject.get('householdId'),
//         userId: userId,
//         email: (data || {}).email,
//         createdAt: new Date()
//     }

//     // TODO: If we already have one just return it. But honestly who cares
//     const result = await admin.firestore().collection('invitations').add(invitation).catch(onError)

//     return {
//         success: true,
//         invitationId: ((result as any) || {}).id
//     }
// })

// exports.acceptInvitation = functions.https.onCall(async (data, context) => {
//     if (context.auth === null) return;
//     if (data === null || data.invitationId === null) return;
//     const user = (await admin.firestore().collection('users').doc(context.auth!.uid).get().catch(onError)) as DocumentSnapshot
//     if (user === null || !user.exists) return

//     const invitationId = data.invitationId
//     const invitation = (await admin.firestore().collection('invitations').doc(invitationId).get().catch(onError)) as DocumentSnapshot
//     if (!invitation.exists) return

//     const householdId = invitation.get('householdId').toString()
//     // Check to see if the household exists
//     const householdDocument = admin.firestore().collection('households').doc(householdId)
//     const household = (await householdDocument.get().catch(onError)) as DocumentSnapshot
//     if (!household.exists) return

//     const existingUsers = await householdDocument.collection('users').get().catch(onError) as QuerySnapshot
//     const firstUser = existingUsers.docs[0];
//     const originalUser = await admin.firestore().collection('users').doc(firstUser.id).get().catch(onError) as DocumentSnapshot

//     await user.ref.set({ 'householdId': householdId }, { merge: true }).catch(onError)
//     await householdDocument.collection('users').doc(context.auth!.uid).set({ 'createdAt': new Date() })

//     console.log(`Sending message to ${originalUser.get('messagingToken')} that ${user.get('displayName')} joined up`)
//     const messageResponse = await admin.messaging().sendToDevice(
//         originalUser.get('messagingToken'),
//         {
//             data: {
//                 message: "Someone joined the fam, fam!",
//                 click_action: "FLUTTER_NOTIFICATION_CLICK"
//             },
//             notification: {
//                 title: "Someone joined your family!",
//                 body: `It was ${user.get('displayName')}!`
//             }
//         }
//     )

//     console.log(`Got message response on invite. Successes: ${messageResponse.successCount}`)

//     return { householdId: householdId }
// })

// function isDocumentReference(result: void | DocumentReference): result is DocumentReference {
//     return (<DocumentReference>result).id !== undefined;
// }

exports.initializeUser = functions.auth.user().onCreate(async (user, context) => {
    console.log(`Executing onCreate:: user -> ${user}, context -> ${context}`)

    const firestore = admin.firestore()
    const usersCollection = firestore.collection('users')

    // Create and save the user object
    const userData = {
        'uid': user.uid,
        'email': user.email,
        'displayName': user.displayName,
        'photoUrl': user.photoURL,
        'createdAt': new Date()
    }
    const userReference = usersCollection.doc(user.uid);
    await userReference.set(userData).catch(onError);

    console.log(`User created: ${userReference}`)


})

// exports.saveMessagingToken = functions.https.onCall(async (data, context) => {
//     if (context.auth === null) return;

//     const firestore = admin.firestore()
//     const userObject = firestore.doc(`users/${context.auth!.uid}`);
//     await userObject.set({ 'messagingToken': data['token'] }, { merge: true });
// })

const words = [
    "me",
    "cowboy",
    "exactly",
    "swung",
    "cause",
    "fun",
    "happen",
    "separate",
    "do",
    "discover",
    "wool",
    "below",
    "cloud",
    "news",
    "went",
    "related",
    "composed",
    "promised",
    "bread",
    "additional",
    "ocean",
    "sent",
    "design",
    "balloon",
    "done",
    "different",
    "announced",
    "stretch",
    "dig",
    "graph",
    "rocket",
    "floating",
    "teach",
    "thee",
    "birthday",
    "this",
    "too",
    "grew",
    "scale",
    "in",
    "hearing",
    "brave",
    "leaving",
    "yesterday",
    "remember",
    "push",
    "dozen",
    "hospital",
    "event",
    "blew",
    "trace",
    "ball",
    "agree",
    "movie",
    "minerals",
    "source",
    "football",
    "path",
    "breeze",
    "kitchen",
    "from",
    "church",
    "joined",
    "instant",
    "anyway",
    "sold",
    "upon",
    "driven",
    "hungry",
    "frighten",
    "bill",
    "some",
    "thousand",
    "along",
    "square",
    "game",
    "feel",
    "catch",
    "foreign",
    "spin",
    "cup",
    "very",
    "shown",
    "failed",
    "voice",
    "team",
    "tool",
    "influence",
    "tape",
    "largest",
    "particular",
    "paint",
    "summer",
    "contrast",
    "smaller",
    "thrown",
    "nearby",
    "familiar",
    "already",
    "eventually",
    "including",
    "ancient",
    "locate",
    "program",
    "bottom",
    "actually",
    "birth",
    "arrive",
    "kitchen",
    "importance",
    "dot",
    "leave",
    "package",
    "list",
    "way",
    "gasoline",
    "drop",
    "purple",
    "simplest",
    "desert",
    "beside",
    "guard",
    "with",
    "route",
    "grandfather",
    "higher",
    "empty",
    "suit",
    "universe",
    "ran",
    "cry",
    "exclaimed",
    "serious",
    "held",
    "flew",
    "mass",
    "bread",
    "lucky",
    "attached",
    "stone",
    "mountain",
    "affect",
    "rather",
    "judge",
    "cover",
    "gravity",
    "struggle",
    "while",
    "usual",
    "give",
    "rod",
    "sometime",
    "gently",
    "jack",
    "people",
    "managed",
    "anyone",
    "magic",
    "never",
    "wall",
    "quietly",
    "beyond",
    "sure",
    "position",
    "loud",
    "occasionally",
    "satisfied",
    "receive",
    "ground",
    "bread",
    "dark",
    "actually",
    "slept",
    "would",
    "take",
    "table",
    "so",
    "exactly",
    "receive",
    "stronger",
    "fastened",
    "leaving",
    "five",
    "ill",
    "join",
    "lake",
    "difference",
    "potatoes",
    "belong",
    "alike",
    "coffee",
    "are",
    "basic",
    "known",
    "stood",
    "respect",
    "wrapped",
    "sides",
    "egg",
    "third",
    "elephant",
    "each",
    "clothing",
    "music",
    "eye",
    "pink",
    "manner",
    "wagon",
    "brave",
    "union",
    "solar",
    "rule",
    "slight",
    "leave",
    "own",
    "moving",
    "wrapped",
    "ball",
    "trail",
    "molecular",
    "bottom",
    "opinion",
    "long",
    "adult",
    "sit",
    "speed",
    "busy",
    "laugh",
    "information",
    "had",
    "crowd",
    "pony",
    "garage",
    "select",
    "bread",
    "division",
    "opportunity",
    "spell",
    "rain",
    "shoot",
    "like",
    "way",
    "last",
    "tell",
    "share",
    "diameter",
    "flower",
    "arrive",
    "thing",
    "broke",
    "between",
    "thee",
    "nobody",
    "everyone",
    "shoot",
    "busy",
    "sense",
    "time",
    "making",
    "tales",
    "organization",
    "faster",
    "including",
    "whatever",
    "hay",
    "upward",
    "throat",
    "corn",
    "thank",
    "means",
    "uncle",
    "dust",
    "team",
    "instance",
    "tales",
    "school",
    "ancient",
    "silent",
    "doll",
    "signal",
    "more",
    "finish",
    "important",
    "rain",
    "frog",
    "each",
    "further",
    "strength",
    "slept",
    "conversation",
    "nails",
    "nature",
    "victory",
    "dream",
    "out",
    "adventure",
    "sheet",
    "practice",
    "doll",
    "river",
    "these",
    "purpose",
    "mighty",
    "stuck",
    "house",
    "inside",
    "pie",
    "any",
    "excited",
    "aware",
    "copy",
    "military",
    "applied",
    "learn",
    "member",
    "dug",
    "deeply",
    "state",
    "quite",
    "pleasure",
    "leaf",
    "given",
    "mad",
    "extra",
    "force",
    "gate",
    "green",
    "bridge",
    "discussion",
    "younger",
    "cry",
    "improve",
    "duck",
    "my",
    "consider",
    "parallel",
    "herd",
    "stay",
    "habit",
    "onlinetools",
    "meal",
    "valuable",
    "secret",
    "wall",
    "beneath",
    "long",
    "flag",
    "remove",
    "power",
    "sugar",
    "fourth",
    "birth",
    "would",
    "sick",
    "valuable",
    "bottle",
    "hole",
    "size",
    "mountain",
    "beginning",
    "total",
    "doctor",
    "pool",
    "map",
    "dark",
    "green",
    "separate",
    "baby",
    "area",
    "frighten",
    "affect",
    "layers",
    "mirror",
    "if",
    "stood",
    "port",
    "congress",
    "rabbit",
    "shelf",
    "regular",
    "grass",
    "species",
    "writer",
    "might",
    "shoulder",
    "sky",
    "collect",
    "dull",
    "his",
    "specific",
    "syllable",
    "possible",
    "relationship",
    "several",
    "molecular",
    "about",
    "planet",
    "immediately",
    "block",
    "different",
    "combination",
    "audience",
    "morning",
    "closely",
    "brown",
    "constantly",
    "circle",
    "refused",
    "car",
    "slight",
    "final",
    "sides",
    "shut",
    "slip",
    "build",
    "poetry",
    "public",
    "safety",
    "production",
    "be",
    "twice",
    "trip",
    "immediately",
    "social",
    "also",
    "thank",
    "treated",
    "structure",
    "tight",
    "living",
    "carried",
    "molecular",
    "usually",
    "street",
    "under",
    "every",
    "begun",
    "summer",
    "thy",
    "noted",
    "time",
    "doubt",
    "frozen",
    "exercise",
    "mind",
    "hour",
    "comfortable",
    "truth",
    "community",
    "structure",
    "difficulty",
    "complex",
    "carbon",
    "triangle",
    "slip",
    "passage",
    "sport",
    "while",
    "tell",
    "food",
    "production",
    "tower",
    "ride",
    "furniture",
    "century",
    "at",
    "till",
    "discuss",
    "told",
    "body",
    "pet",
    "scene",
    "has",
    "bee",
    "earn",
    "mostly",
    "work",
    "sheep",
    "water",
    "properly",
    "colony",
    "castle",
    "stepped",
    "rocket",
    "quarter",
    "actual",
    "dear",
    "gun",
    "hospital",
    "mouth",
    "scene",
    "twenty",
    "given",
    "circle",
    "bread",
    "late",
    "held",
    "browserling",
    "moment",
    "young",
    "another",
    "character",
    "printed",
    "thousand",
    "why",
    "kitchen",
    "diagram",
    "whispered",
    "accurate",
    "hard",
    "threw",
    "handle",
    "improve",
    "regular",
    "still",
    "impossible",
    "cup",
    "busy",
    "development",
    "oxygen",
    "protection",
    "refer",
    "term",
    "pick",
    "program",
    "machinery",
    "simplest",
    "bread",
    "cloth",
    "sand",
    "lost",
    "poor",
    "heard",
    "closer",
    "quietly",
    "cattle",
    "mice",
    "needed",
    "worker",
    "nearby",
    "mark",
    "married",
    "went",
    "tall",
    "indeed",
    "or",
    "ate",
    "offer",
    "early",
    "parallel",
    "smell",
    "declared",
    "pour",
    "peace",
    "bow",
    "hundred",
    "wheat",
    "down",
    "parent",
    "salt",
    "stairs",
    "mixture",
    "halfway",
    "brought",
    "lake",
    "dress",
    "shut",
    "seems",
    "log",
    "done",
    "break",
    "mixture",
    "bone",
    "later",
    "however",
    "similar",
    "cool",
    "setting",
    "feel",
    "cup",
    "taught",
    "husband",
    "older",
    "uncle",
    "solid",
    "help",
    "give",
    "correctly",
    "valuable",
    "quietly",
    "cage",
    "none",
    "thrown",
    "manner",
    "scientist",
    "office",
    "everybody",
    "respect",
    "rather",
    "steady",
    "your",
    "board",
    "center",
    "have",
    "plane",
    "difference",
    "wheel",
    "about",
    "summer",
    "that",
    "tight",
    "driver",
    "outside",
    "ball",
    "near",
    "instrument",
    "there",
    "writer",
    "pool",
    "soil",
    "escape",
    "wave",
    "equator",
    "tonight",
    "truck",
    "he",
    "cool",
    "location",
    "wide",
    "pie",
    "other",
    "root",
    "gave",
    "return",
    "fox",
    "thou",
    "football",
    "appearance",
    "combination",
    "gravity",
    "back",
    "declared",
    "excitement",
    "magic",
    "railroad",
    "notice",
    "language",
    "storm",
    "great",
    "declared",
    "carry",
    "planning",
    "store",
    "stand",
    "business",
    "pony",
    "coffee",
    "thread",
    "zoo",
    "knowledge",
    "station",
    "cabin",
    "life",
    "walk",
    "some",
    "easily",
    "if",
    "try",
    "repeat",
    "origin",
    "universe",
    "passage",
    "wood",
    "excellent",
    "fair",
    "dug",
    "naturally",
    "source",
    "below",
    "state",
    "pipe",
    "war",
    "police",
    "whatever",
    "whether",
    "today",
    "whether",
    "find",
    "tonight",
    "burn",
    "single",
    "weigh",
    "four",
    "remain",
    "factor",
    "noted",
    "evidence",
    "dig",
    "frozen",
    "floating",
    "report",
    "ordinary",
    "tide",
    "tube",
    "unusual",
    "bet",
    "rate",
    "pole",
    "fifteen",
    "stock",
    "blew",
    "win",
    "stronger",
    "by",
    "aware",
    "am",
    "service",
    "affect",
    "baby",
    "door",
    "his",
    "men",
    "term",
    "island",
    "fill",
    "tide",
    "somewhere",
    "lot",
    "parts",
    "report",
    "rocket",
    "thy",
    "tonight",
    "largest",
    "rush",
    "be",
    "village",
    "think",
    "knew",
    "death",
    "thy",
    "sure",
    "just",
    "journey",
    "class",
    "brief",
    "search",
    "pitch",
    "cabin",
    "three",
    "row",
    "means",
    "mind",
    "mood",
    "success",
    "outline",
    "buffalo",
    "mass",
    "control",
    "exciting",
    "beat",
    "western",
    "grown",
    "also",
    "hurry",
    "sent",
    "here",
    "flat",
    "farm",
    "track",
    "slow",
    "adult",
    "principle",
    "date",
    "or",
    "frequently",
    "whole",
    "cold",
    "money",
    "avoid",
    "region",
    "shown",
    "must",
    "in",
    "search",
    "building",
    "highest",
    "round",
    "station",
    "happened",
    "note",
    "nation",
    "dead",
    "sun",
    "breathe",
    "began",
    "gray",
    "barn",
    "silent",
    "managed",
    "dangerous",
    "fourth",
    "moon",
    "identity",
    "either",
    "catch",
    "explanation",
    "ate",
    "guide",
    "grew",
    "addition",
    "remain",
    "alphabet",
    "industry",
    "habit",
    "color",
    "those",
    "say",
    "tears",
    "bow",
    "appropriate",
    "must",
    "paper",
    "yet",
    "anyway",
    "faster",
    "finish",
    "black",
    "increase",
    "send",
    "development",
    "voyage",
    "she",
    "lying",
    "neighbor",
    "beautiful",
    "people",
    "through",
    "suddenly",
    "forty",
    "wind",
    "add",
    "brother",
    "closely",
    "jack",
    "wrong",
    "give",
    "engineer",
    "news",
    "seven",
    "arrow",
    "fish",
    "before",
    "lamp",
    "stage",
    "applied",
    "mix",
    "spring",
    "became",
    "stage",
    "trouble",
    "scale",
    "rise",
    "solution",
    "run",
    "beautiful",
    "concerned",
    "build",
    "contrast",
    "make",
    "plural",
    "salt",
    "length",
    "hit",
    "smooth",
    "success",
    "activity",
    "high",
    "through",
    "protection",
    "below",
    "doing",
    "finest",
    "reader",
    "brought",
    "strength",
    "listen",
    "chest",
    "space",
    "thy",
    "from",
    "general",
    "done",
    "furniture",
    "wing",
    "tropical",
    "metal",
    "population",
    "living",
    "sail",
    "outside",
    "circus",
    "third",
    "service",
    "national",
    "brought",
    "while",
    "he",
    "softly",
    "chicken",
    "drive",
    "post",
    "tune",
    "hidden",
    "butter",
    "lay",
    "mix",
    "thin",
    "stop",
    "cream",
    "opportunity",
    "hospital",
    "sets",
    "standard",
    "copper",
    "freedom",
    "happily",
    "throw",
    "written",
    "swung",
    "origin",
    "dance",
    "straight",
    "these",
    "wind",
    "check",
    "further",
    "kitchen",
    "nose",
    "practice",
    "lost",
    "flight",
    "sleep",
    "solution",
    "bound",
    "rabbit",
    "good",
    "handle",
    "white",
    "when",
    "disappear",
    "cook",
    "similar",
    "last",
    "prevent",
    "gift",
    "green",
    "characteristic",
    "pull",
    "sing",
    "agree",
    "across",
    "bite",
    "pet",
    "naturally",
    "sad",
    "straight",
    "son",
    "principal",
    "rough",
    "garage",
    "swimming",
    "ever",
    "throat",
    "hospital",
    "large",
    "pole",
    "middle",
    "wish",
    "from",
    "including",
    "why",
    "smallest",
    "division",
    "sum",
    "he",
    "furniture",
    "announced",
    "learn",
    "too",
    "instant",
    "unusual",
    "listen",
    "therefore",
    "running",
    "drive",
    "run",
    "black",
    "term",
    "root"
]