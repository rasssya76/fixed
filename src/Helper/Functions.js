"use strict";

const Baileys = require("baileys");

function getContentType(message) {
    const messageContent = Baileys.extractMessageContent(message);
    return Baileys.getContentType(messageContent);
}

const CONTENT_HANDLERS = {
    conversation: msg => msg.conversation,
    extendedTextMessage: msg => msg.extendedTextMessage?.text || "",
    imageMessage: msg => msg.imageMessage?.caption || "",
    videoMessage: msg => msg.videoMessage?.caption || "",
    documentMessageWithCaption: msg => msg.documentMessageWithCaption?.caption || "",
    protocolMessage: msg => getContentFromMsg({
        message: msg.protocolMessage?.editedMessage
    }),
    buttonsMessage: msg => msg.buttonsMessage?.contentText || "",
    interactiveMessage: msg => msg.interactiveMessage?.body?.text || "",
    buttonsResponseMessage: msg => msg.buttonsResponseMessage?.selectedButtonId || "",
    listResponseMessage: msg => msg.listResponseMessage?.singleSelectReply?.selectedRowId || "",
    templateButtonReplyMessage: msg => msg.templateButtonReplyMessage?.selectedId || "",
    interactiveResponseMessage: msg => {
        const interactiveMsg = msg.interactiveResponseMessage;
        let text = interactiveMsg?.selectedButtonId || "";
        if (!text && interactiveMsg?.nativeFlowResponseMessage) {
            const params = JSON.parse(interactiveMsg.nativeFlowResponseMessage.paramsJson || "{}");
            text = params.id || params.selectedId || params.button_id || "";
        }
        return text;
    }
};

const getSender = (msg, client) => msg.key.fromMe ? client.user.id : msg.key.participant || msg.key.remoteJid;

function getContentFromMsg(msg) {
    const contentType = getContentType(msg.message) ?? "";
    return CONTENT_HANDLERS[contentType]?.(msg.message) || "";
}

function getDb(collection, jid) {
    const normalized = Baileys.jidNormalizedUser(jid);
    if (collection.name === "users" && Baileys.isLidUser(normalized)) return collection.getOrCreate(user => user.jid === normalized, {
        jid: normalized
    });
    if (collection.name === "users" && Baileys.isJidUser(normalized)) return collection.getOrCreate(user => user.alt === normalized, {
        alt: normalized
    });
    if (collection.name === "groups" && Baileys.isJidGroup(normalized)) return collection.getOrCreate(group => group.jid === normalized, {
        jid: normalized
    });
}

function getPushName(jid, pushNames) {
    const normalized = Baileys.jidNormalizedUser(jid);
    return normalized ? pushNames[normalized] || normalized : null;
}

function getId(jid) {
    return Baileys.jidDecode(jid)?.user || jid;
}

const decodeJid = (jid) => {
    if (/:\d+@/gi.test(jid)) {
        const decoded = Baileys.jidDecode(jid);
        return decoded?.user && decoded?.server ? Baileys.jidEncode(decoded.user, decoded.server) : jid;
    }
    return jid;
};

const convertJid = async (type, jid, jids, client) => {
    const decoced = decodeJid(jid);
    if (type === "lid" && Baileys.isJidUser(jid)) {
        for (const [lid, data] of Object.entries(jids)) {
            if (data.pn === decoced) return lid;
        }
        try {
            const results = await client.onWhatsApp(decoced);
            if (results && results.length > 0 && results[0].exists) return results[0].jid;
        } catch {}
        return decoced;
    } else if (type === "pn" && Baileys.isLidUser(jid)) {
        if (jids[decoced] && jids[decoced].pn) return jids[decoced].pn;
        return decoced;
    }
    return decoced;
};

module.exports = {
    getContentType,
    getContentFromMsg,
    getDb,
    getPushName,
    getId,
    getSender,
    convertJid,
    decodeJid
};
