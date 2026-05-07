let replyStatus = false;
let replyString = [];
const morePfp = document.querySelector("#stock-pfp-choose");
const signInForm = document.querySelector(".sign-in-form");
let socket; 
let stickers = {};

async function renderStickers() {
    const response = await fetch("/api/stickers");
    stickers = await response.json();
}

renderStickers();

const main = document.querySelector("main");

const allPfp = [{link: "/images/stock-pfp/uzi-pfp.png", text: "UZI", text_color: "#080741", id: 1},
                {link: "/images/stock-pfp/n-pfp.png", text: "SD-N", text_color: "#51FF00", id: 2},
                {link: "/images/stock-pfp/v-pfp.png", text: "SD-V", text_color: "#00FFF2", id: 3},
                {link: "/images/stock-pfp/cyn-pfp.png", text: "Cynessa", text_color: "#473965", id: 4},
                {link: "/images/stock-pfp/lizzie-pfp.png", text: "Lizzie", text_color: "#E695C3", id: 5},
                {link: "/images/stock-pfp/doll-pfp.png", text: "Doll", text_color: "#FF0000", id: 6},
                {link: "/images/stock-pfp/absolute-solver-pfp.png", text: "Absolute Solver", text_color: "linear-gradient(90deg, #9F43A1 0%, #FF0000 100%)", id: 7}]

window.addEventListener("DOMContentLoaded", async () => {
    const savedToken = localStorage.getItem("chatToken");
    if (!savedToken) return; 
    
        try {
            const response = await fetch("/api/autologin", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ token: savedToken})
            });
            const result = await response.json();
            if (result.success) {
                localStorage.setItem("username", result.user.username);
                localStorage.setItem("pfplink", result.user.pfplink);
                localStorage.setItem("role", result.user.role);
                localStorage.setItem("muteStatus", result.user.mutestatus);
                localStorage.setItem("chatToken", result.user.token)
                initSocket();
                console.log("token ", result.user.token)
            } else {
                console.log("Auto-login failed:", result.message);
            }
        } catch (err) {
            console.error("Auto-login failed:", err);
        }
    }
);

function showOnPage() {
    const allPfpCanvas = document.createElement("div");
        allPfpCanvas.className = "all-pfp-canvas";
        allPfp.forEach((pfpSrc) => {
            const pfpDiv = document.createElement("div");
            pfpDiv.className = "pfp-div";
            const pfpImg = document.createElement("img");
            pfpImg.src = pfpSrc.link;
            pfpImg.className = "stock-pfp";
            pfpDiv.appendChild(pfpImg);
            const pfpText = document.createElement("h1");
            pfpText.textContent = pfpSrc.text;
            pfpText.className = "pfp-text";
            const pfpButton = document.createElement("button");
            pfpButton.textContent = "";
            pfpButton.className = "pfpButton";
            pfpButton.addEventListener("click", () => {
                morePfp.src = pfpSrc.link;
                morePfp.id = pfpSrc.id;
                allPfpCanvas.style.animation = "fadeOut 0.7s forwards";
                setTimeout(() => {
                    allPfpCanvas.style.display = "none";
                    allPfpCanvas.style.animation = "none";
                    signInForm.style.animation = "fadeIn 0.7s forwards";
                    signInForm.style.display = "flex";
                }, 700);
            });
            pfpButton.appendChild(pfpImg);
            pfpDiv.appendChild(pfpButton);
            if(pfpSrc.text === "Absolute Solver") {
                pfpText.style.background = pfpSrc.text_color;
                pfpText.style.webkitBackgroundClip = "text";
                pfpText.style.webkitTextFillColor = "transparent";
                pfpText.style.backgroundClip = "text";
                pfpText.style.textFillColor = "transparent";
            } else {
                pfpText.style.color = pfpSrc.text_color;
            }
            pfpDiv.appendChild(pfpText);
            allPfpCanvas.appendChild(pfpDiv);
           
        });
        main.appendChild(allPfpCanvas);
signInForm.style.animation = "fadeOut 0.7s forwards";
    setTimeout(() => {
        signInForm.style.display = "none";
        signInForm.style.animation = "none";
        allPfpCanvas.style.animation = "fadeIn 0.7s forwards";
    }, 700);
};

morePfp.addEventListener("click", () => {
    showOnPage();
})

const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const pfpInput = document.querySelector("#pfp-link");

const token = localStorage.getItem("chatToken");

//function initSocket(data) {
//    if (socket) {
//        socket.removeAllListeners();
//        socket.disconnect();
//    }
//    socket = io({auth: {token: localStorage.getItem("chatToken")}});
//    socket.on("connect", ()=>{
//        console.log(socket.id);
//   
//            socket.emit("register username", localStorage.getItem("username"));
//            showGlobalChat();
//            socket.emit("request history");
//        })
//    socket.on("chat message", (data) => {
//       
//
//        renderMessage(data);
//    });
//    
//    socket.on("chat history", (history) => {
//        console.log(history.length);
//        history.forEach(renderMessage);
//    });
//    
//    socket.on("system message", (data) => {
//        const msgDiv = document.createElement("div");
//        msgDiv.className = "system-message";
//        const systemMsg = document.createElement("p");
//        systemMsg.textContent = data.text;
//        msgDiv.appendChild(systemMsg);
//        msgDiv.scrollTop = msgDiv.scrollHeight;
//        document.getElementById("messages").appendChild(msgDiv);
//    });
//
//    socket.on("clear chat", () =>{ 
//        const messageDiv = document.getElementById("messages")
//        if (messageDiv) {
//            messageDiv.innerHTML = "";
//        }
//    });
//    
//    socket.on("kicked user", () =>{
//        alert("You have been kicked!")
//    })
//
//    socket.on("muted", (data) =>{
//        if (data?.muteRole) {
//            localStorage.setItem("muteRole", data.muteRole);
//        }
//        const sendButton = document.querySelector(".send-message-button");
//        const input = document.getElementById("messageInput");
//        const uiDiv = document.querySelector(".chat-ui")
//        uiDiv.innerHTML = "";
//        localStorage.setItem("status", "muted");
//    })
//
//    socket.on("unmuted", () =>{
//        localStorage.removeItem("muteRole");
//        const messageInput = document.createElement("input");
//    messageInput.type = "text";
//    messageInput.placeholder = "Type here";
//    messageInput.className = "info-input";
//    messageInput.id = "messageInput";
//    messageInput.maxlength = 500;
//    
//    const sendButton = document.createElement("button");
//    const sendIcon = document.createElement("img");
//    sendIcon.src = "images/Vector.png";
//    sendIcon.className = "send-icon";
//    sendButton.appendChild(sendIcon);
//    sendButton.className = "send-message-button";
//    sendButton.addEventListener("click",  () => sendMessage(messageInput));
//        const uiDiv = document.querySelector(".chat-ui")
//        uiDiv.appendChild(messageInput);
//        uiDiv.appendChild(sendButton);
//        localStorage.removeItem("status");
//    })
//
//    socket.on("changed role", (data) =>{
//        const roleText = document.getElementById("role-text")
//        roleText.textContent = "Role: " + data.value;
//    })
//
//    socket.on("update pfp", (data) =>{
//        const accountPfp = document.querySelector(".account-pfp");
//        if (accountPfp) {
//            accountPfp.src = data.value;
//            localStorage.setItem("pfplink", data.value);
//        }
//    })
//
//    socket.on("delete message", (data) => {
//        const messages = document.querySelectorAll(".message");
//        messages.forEach((message) => {
//            if (message.dataset.id === data.messageId) {
//                message.remove();
//            }
//        })
//    })
//}

let socketInitialized = false;

function initSocket() {
  if (socketInitialized) return;
  socketInitialized = true;

  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = undefined;
    }

    console.log("initSocket: connecting with token:", localStorage.getItem("chatToken"));

    socket = io({ auth: { token: localStorage.getItem("chatToken") } });

    // remove any leftover handlers (defensive)
    socket.off("chat history");
    socket.off("chat message");
    socket.off("system message");
    socket.off("kicked user");
    socket.off("muted");
    socket.off("unmuted");
    socket.off("update pfp");
    socket.off("changed role");
    socket.off("delete message");
    socket.off("clear chat");

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("register username", localStorage.getItem("username"));

      // Build UI synchronously
      showGlobalChat();

      // Wait for #messages then request history (robust)
      const waitForMessagesContainer = (timeout = 2000) => {
        const start = Date.now();
        return new Promise((resolve, reject) => {
          const check = () => {
            const el = document.getElementById("messages");
            if (el) return resolve(el);
            if (Date.now() - start > timeout) return reject(new Error("messages container not found"));
            requestAnimationFrame(check);
          };
          check();
        });
      };

      (async () => {
        try {
          await waitForMessagesContainer(2000);
          console.log("messages container ready — requesting history");

          let historyReceived = false;
          const onHistory = (history) => {
            historyReceived = true;
            console.log("chat history received length:", history?.length);
            history.forEach(renderMessage);
          };

          socket.once("chat history", onHistory);
          socket.emit("request history");

          setTimeout(() => {
            if (!historyReceived) {
              console.warn("No history received — retrying request history");
              socket.once("chat history", onHistory);
              socket.emit("request history");
            }
          }, 700);
        } catch (err) {
          console.error("Failed to find messages container before requesting history:", err);
          socket.emit("request history");
        }
      })();
    });

    socket.on("connect_error", (err) => {
      console.error("initSocket: connect_error", err);
    });

    socket.on("disconnect", (reason) => {
      console.log("initSocket: disconnected", reason);
      socketInitialized = false;
    });

    socket.on("chat history", (history) => {
      // defensive: if this fires outside connect flow, still render but avoid duplicates
      console.log("initSocket: received history length:", history?.length);
      history.forEach(renderMessage);
    });

    socket.on("chat message", (data) => {
      console.log("initSocket: incoming chat message", data?.messageId);
      renderMessage(data);
    });

    socket.on("system message", (data) => {
       const msgDiv = document.createElement("div");
       msgDiv.className = "system-message";
       const systemMsg = document.createElement("p");
       systemMsg.textContent = data.text;
       msgDiv.appendChild(systemMsg);
       msgDiv.scrollTop = msgDiv.scrollHeight;
       document.getElementById("messages").appendChild(msgDiv);
   });
    
    socket.on("clear chat", () => {
      const messageDiv = document.getElementById("messages");
      if (messageDiv) messageDiv.innerHTML = "";
    });

    socket.on("changed role", (data) =>{
    const roleText = document.getElementById("role-text")
    roleText.textContent = "Role: " + data.value;
})
socket.on("update pfp", (data) =>{
    const accountPfp = document.querySelector(".account-pfp");
    if (accountPfp) {
        accountPfp.src = data.value;
        localStorage.setItem("pfplink", data.value);
    }
})
socket.on("delete message", (data) => {
    const messages = document.querySelectorAll(".message");
    messages.forEach((message) => {
        if (message.dataset.id === data.messageId) {
            message.remove();
        }
    })
    socket.on("kicked user", () =>{
    alert("You have been kicked!")
})
socket.on("muted", (data) =>{
    if (data?.muteRole) {
        localStorage.setItem("muteRole", data.muteRole);
    }
    const sendButton = document.querySelector(".send-message-button");
    const input = document.getElementById("messageInput");
    const uiDiv = document.querySelector(".chat-ui")
    uiDiv.innerHTML = "";
    localStorage.setItem("status", "muted");
})
socket.on("unmuted", () =>{
    localStorage.removeItem("muteRole");
    const messageInput = document.createElement("input");
messageInput.type = "text";
messageInput.placeholder = "Type here";
messageInput.className = "info-input";
messageInput.id = "messageInput";
messageInput.maxlength = 500;
//    

const sendButton = document.createElement("button");
const sendIcon = document.createElement("img");
sendIcon.src = "images/Vector.png";
sendIcon.className = "send-icon";
sendButton.appendChild(sendIcon);
sendButton.className = "send-message-button";
sendButton.addEventListener("click",  () => sendMessage(messageInput));
    const uiDiv = document.querySelector(".chat-ui")
    uiDiv.appendChild(messageInput);
    uiDiv.appendChild(sendButton);
    localStorage.removeItem("status");
})
})

    console.log("initSocket: socket object created (pending connect):", !!socket);
  } catch (err) {
    console.error("initSocket: threw error", err);
  }
}



async function saveUserData() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const pfplink = morePfp.src;
    if (!username || !password) { 
        alert("Please fill in all fields.");
        return;
    }

    try {
        const data = {username, password, pfplink, token}

        const response = await fetch("/api/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username, password, pfplink, token})
        });

        const result = await response.json();
        if (result.success){
            localStorage.setItem("username", result.user.username);
            localStorage.setItem("pfplink", result.user.pfplink);
            localStorage.setItem("role", "user");
            localStorage.setItem("chatToken", result.user.token);
            initSocket();
            alert("Account Created Successfully!");
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error("Register error:", err);
        alert("Please fill in all fields.");
    }
    
}

if (localStorage.getItem === "username" || localStorage.getItem === "password") {
    saveUserData();
}

async function signInLastSavedAccount() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        alert("Please fill in all fields.");
        return;
    }


    try {

        const response = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username, password, token: localStorage.getItem("chatToken")})
        });
        
        const result = await response.json();
        if (result.success){
            localStorage.setItem("username", result.user.username);
            localStorage.setItem("pfplink", result.user.pfplink);
            localStorage.setItem("role", result.user.role);
            localStorage.setItem("muteStatus", result.user.mutestatus);
            localStorage.setItem("chatToken", result.user.token);
            morePfp.src = result.user.pfplink;
            initSocket();
            alert("Signed in as: " + username);
        } else {
            alert("Login failed: " +result.message);
        }
    } catch (err) {
        console.error("Login error:", err);
        alert("Login error");
    }
}
    
function renderMessage(data) {
    if (document.querySelector(`.message[data-id="${data.messageId}"]`)) {
        return;
    }

    let yourOriginalReply = false;
    let repliedStatus = false;
    
    function showExtra() {
        const extra = msgDiv.querySelector(".extra-interact-div");
        extra.style.display = "flex";
        if (yourOriginalReply) {
            msgDiv.style.backgroundColor = "rgba(0, 255, 0, 0.2)"
        } else if (repliedStatus) {
            msgDiv.style.backgroundColor = "rgba(255, 255, 255, 0.18)"
        } else {
            msgDiv.style.backgroundColor = "rgba(255, 255, 255, 0.3)"
        }
        msgDiv.style.borderRadius = "15px";
        msgDiv.style.padding = "2px";
    
    }
    function hideExtra() {
        const extra = msgDiv.querySelector(".extra-interact-div");
        extra.style.display = "none";
        if (yourOriginalReply) {
            msgDiv.style.backgroundColor = "rgba(0, 255, 0, 0.2)"
        } else if (repliedStatus) {
            msgDiv.style.backgroundColor = "rgba(255, 255, 255, 0.18)"
        } else {
            msgDiv.style.backgroundColor = "transparent"

        }
        msgDiv.style.border = "none";
        msgDiv.style.padding = "2px";
    }

    let  extraVisible = false;

    function extraChanges() {
        if (replyStatus) return;
        const extra = msgDiv.querySelector(".extra-interact-div");
        extraVisible = !extraVisible;
        if (extraVisible) {
            showExtra();
        } else {
            hideExtra();
        }
    }
    const msgDiv = document.createElement("div");
    msgDiv.className = "message";
    msgDiv.dataset.id = data.messageId;
    msgDiv.addEventListener("click", () => {
        extraChanges();
        if (repliedStatus && !yourOriginalReply) {
            msgDiv.style.background = "rgba(255,255,255,0.18)";
            msgDiv.style.borderRadius = "15px";
        }
    })

    const normalMessageDiv = document.createElement("div");
    normalMessageDiv.className = "normal-message";
    
    const msgPfp = document.createElement("img");
    msgPfp.src = data.pfplink;
    msgPfp.className = "message-pfp";
    normalMessageDiv.appendChild(msgPfp);
    
    const msgUsername = document.createElement("h2");
    msgUsername.textContent = data.username;
    msgUsername.className = "message-username " + (data.role);
    
    const roleBadgeImg = document.createElement("img")
    roleBadgeImg.src = "/images/icons/" + data.role + ".svg"
    roleBadgeImg.className = "role-badge-img"
    
    const roleBadge = document.createElement("p");
    const roleData = data.role;
    roleBadge.textContent = roleData.toUpperCase();
    roleBadge.className = "role-badge " + data.role;
    
    const roleBadgeDiv = document.createElement("div");
    roleBadgeDiv.className = "role-badge-div " + (data.role);
    roleBadgeDiv.appendChild(roleBadgeImg);
    roleBadgeDiv.appendChild(roleBadge);
    
    const timeStamp = document.createElement("p");
    const dateObj = new Date(data.timeStamp);
    const options = {hours: "2-digit", minutes: "2-digit"}
    timeStamp.textContent = dateObj.toLocaleTimeString([], options);
    timeStamp.className = "time-stamp-text";
    
    const usernameAndTimeStampDiv = document.createElement("div");
    usernameAndTimeStampDiv.className = "username-time-stamp-div";
    usernameAndTimeStampDiv.appendChild(msgUsername);
    usernameAndTimeStampDiv.appendChild(roleBadgeDiv);
    usernameAndTimeStampDiv.appendChild(timeStamp);
    
    const msgTextDiv = document.createElement("div");
    msgTextDiv.className = "message-text-div";
    msgTextDiv.appendChild(usernameAndTimeStampDiv);
    
    if (stickers[data.message]){
        const stickerImg = document.createElement("img");
        stickerImg.className = "sticker";
        stickerImg.src = stickers[data.message];
        msgTextDiv.appendChild(stickerImg);
    } else {
        const msgText = document.createElement("p");
        msgText.textContent = data.message;
        msgText.className = "message-text";
        msgTextDiv.appendChild(msgText); 
    }
    
    const replyImg = document.createElement("img");
    replyImg.src = "/images/icons/reply.svg";
    replyImg.className = "reply-img";
    
    const replyText = document.createElement("p");
    replyText.textContent = "Reply";
    replyText.className = "reply-text";
    
    replyDiv = document.createElement("div");
    replyDiv.className = "reply-div";
    replyDiv.addEventListener("click", (event) => {    
        event.stopPropagation();
        replyStatus = !replyStatus;
        if (replyStatus) {
            replyString = [data.username, data.message];
           // msgDiv.classList.add("replied");
           // msgDiv.classList.remove("unreplied");
            const msgInput = document.getElementById("messageInput");
            msgInput.placeholder = `Replying to ${data.username}...`;
            showExtra();
    
        } else {
            replyString = [];
           //msgDiv.classList.add("unreplied");
           //msgDiv.classList.remove("replied");
           hideExtra(); 
          const msgInput = document.getElementById("messageInput");
            msgInput.placeholder = `Text here`;
    
        }
    });
    replyDiv.appendChild(replyImg);
    replyDiv.appendChild(replyText);

    deleteImg = document.createElement("img");
    deleteImg.className = "reply-img";
    deleteImg.src = "/images/icons/delete.svg";

    deleteText = document.createElement("p");
    deleteText.textContent = "Delete";

    deleteDiv = document.createElement("div");
    deleteDiv.className = "reply-div";
    deleteDiv.addEventListener("click", () => {
        socket.emit("delete message", {
            username: localStorage.getItem("username"),
            messageId: data.messageId,
        })
    });
    deleteDiv.appendChild(deleteImg);
    deleteDiv.appendChild(deleteText);

    const currentUser = localStorage.getItem("username");
    const currentRole = localStorage.getItem("role");
    

    const extraInteractDiv = document.createElement("div");
    extraInteractDiv.className = "extra-interact-div";
    extraInteractDiv.appendChild(replyDiv);
    if (currentRole === "moderator" || currentRole === "owner" || data.username === currentUser){
        extraInteractDiv.appendChild(deleteDiv);
    }

    if (data.replyTo) {
        repliedStatus = true;
        const originalReplyMessageDiv = document.createElement("div");
        originalReplyMessageDiv.className = "original-reply-message-div";
        const originalReplyImg = document.createElement("img");
        originalReplyImg.src = "/images/icons/reply.svg";
        originalReplyImg.className = "original-reply-img";
        const originalReplyUsername = document.createElement("p");
        originalReplyUsername.textContent = data.replyTo.username + ":";
        originalReplyUsername.className = "original-reply-username";
        const originalReplyText = document.createElement("p");
        originalReplyText.textContent = data.replyTo.message.slice(0, 20) + (data.replyTo.message.length > 20 ? "..." : "");
        originalReplyText.className = "original-reply-text";
        originalReplyMessageDiv.appendChild(originalReplyImg);
        originalReplyMessageDiv.appendChild(originalReplyUsername);
        originalReplyMessageDiv.appendChild(originalReplyText);
        msgDiv.appendChild(originalReplyMessageDiv);
        if (data.replyTo && data.replyTo.username === localStorage.getItem("username")){
            yourOriginalReply = true;
            msgDiv.style.background = "rgba(0, 255, 0, 0.2)";
            msgDiv.style.borderRadius = "15px";
        } else {
            yourOriginalReply = false;
            msgDiv.style.background = "rgba(255,255,255,0.18)";
            msgDiv.style.borderRadius = "15px";
        }
    }
    
    normalMessageDiv.appendChild(msgTextDiv);
    msgDiv.appendChild(normalMessageDiv);
    msgDiv.appendChild(extraInteractDiv);
    document.getElementById("messages").appendChild(msgDiv);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
    

}


function showGlobalChat(data) {
    const oldAccountDiv = document.querySelector(".account-info");
    if (oldAccountDiv) oldAccountDiv.remove();
    const oldRulesAndSystemInfoDiv = document.querySelector(".rules-system-info-div");
    if (oldRulesAndSystemInfoDiv) oldRulesAndSystemInfoDiv.remove();
    document.querySelectorAll(".message").forEach(msg => msg.remove());
    document.querySelectorAll(".system-message").forEach(msg => msg.remove());
    const oldChat = document.querySelector(".global-chat")
    if (oldChat) oldChat.remove();
    
    const allMessagesDiv = document.createElement("div");
    allMessagesDiv.className = "all-messages";
    allMessagesDiv.id = "messages";
    allMessagesDiv.scrollTop = allMessagesDiv.scrollHeight;
    
    const savedAccountDiv = document.createElement("div");
    savedAccountDiv.className = "account-info";
    const savedUsername = document.createElement("h1");
    savedUsername.textContent = localStorage.getItem("username");
    savedUsername.className = "account-username";
    const savedRole = document.createElement("p");
    savedRole.textContent = "Role: " + localStorage.getItem("role");
    savedRole.id = "role-text";
    const savedAccountTextDiv = document.createElement("div");
    savedAccountTextDiv.className = "saved-account-text-div"
    savedAccountTextDiv.appendChild(savedUsername);
    savedAccountTextDiv.appendChild(savedRole);
    const savedPfp = document.createElement("img");    
    savedPfp.className = "account-pfp";
    savedPfp.src = localStorage.getItem("pfplink");
    const nonInteractiveStuffDiv = document.createElement("div");
    nonInteractiveStuffDiv.className = "non-interactive-stuff-div";
    nonInteractiveStuffDiv.appendChild(savedPfp);
    nonInteractiveStuffDiv.appendChild(savedAccountTextDiv);
    savedAccountDiv.appendChild(nonInteractiveStuffDiv);
    const interactiveStuffDiv = document.createElement("div");
    interactiveStuffDiv.className = "non-interaction-stuff-div";
    const logOutButton = document.createElement("button");
    logOutButton.className = "log-out-button";
    logOutButton.addEventListener("click", () => {
        if (socket){
            socket.emit("logout", {
                username: localStorage.getItem("username"),
                userToken: localStorage.getItem("chatToken")
            });
            socket.removeAllListeners();
            socket.disconnect();
            socket = undefined;
        }
        socketInitialized = false;
        localStorage.removeItem("chatToken");
        localStorage.removeItem("username");
        localStorage.removeItem("pfplink");
        localStorage.removeItem("role");
        localStorage.removeItem("muteStatus");

        globalChatDiv.style.animation = "fadeOut 0.7s forwards";
        savedAccountDiv.style.animation = "fadeOut 0.7s forwards";
        rulesAndSystemInfoDiv.style.animation = "fadeOut 0.7s forwards"
    setTimeout(() => {
        globalChatDiv.style.display = "none";
        globalChatDiv.style.animation = "none";
        savedAccountDiv.style.display = "none";
        savedAccountDiv.style.animation = "none";
        rulesAndSystemInfoDiv.style.display = "none";
        rulesAndSystemInfoDiv.style.animation = "none";
        signInForm.style.display = "flex";
        signInForm.style.animation = "fadeIn 0.7s forwards";
    }, 700);
    })
    const logOutButtonImg = document.createElement("img");
    logOutButtonImg.className = "log-out-img";
    logOutButtonImg.src = "/images/icons/logout.svg"
    logOutButton.appendChild(logOutButtonImg);
    const logOutButtonText = document.createElement("p");
    logOutButtonText.className = "log-out-text";
    logOutButtonText.textContent = "Log Out";
    logOutButton.appendChild(logOutButtonText);
    interactiveStuffDiv.appendChild(logOutButton);
    savedAccountDiv.appendChild(interactiveStuffDiv)
    
    const globalChatDiv = document.createElement("div");
    globalChatDiv.className = "global-chat";
    globalChatDiv.appendChild(allMessagesDiv);
    
    const rulesAndSystemInfoDiv = document.createElement("div");
    rulesAndSystemInfoDiv.className = "rules-system-info-div";
    const rulesTitle = document.createElement("h1");
    rulesTitle.textContent = "Rules And Info ";
    rulesTitle.className = "rules-title";
    rulesAndSystemInfoDiv.addEventListener("click", () => {
        ruleAndInfoList.style.display = ruleAndInfoList.style.display === "none" ? "block" : "none";
    });
    const ruleAndInfoList = document.createElement("ul");
    const rulesAndInfo = ["Be respectful to others", "No spamming or flooding the chat", "No hate speech or offensive language", "No sharing of personal information", "Follow the moderators' instructions", "Have fun and enjoy chatting!", "Chat history resets every 24 hours at midnight UTC"];
    ruleAndInfoList.className = "rules-info-list";
    ruleAndInfoList.style.listStyleType = "numbers";
    ruleAndInfoList.style.display = "none";
    rulesAndInfo.forEach((rule) => {
        const ruleItem = document.createElement("li");
        ruleItem.textContent = rule;
        ruleAndInfoList.appendChild(ruleItem);
    });
    rulesAndSystemInfoDiv.appendChild(rulesTitle);
    rulesAndSystemInfoDiv.appendChild(ruleAndInfoList);
    
    const messageInput = document.createElement("input");
    messageInput.type = "text";
    messageInput.placeholder = "Type here";
    messageInput.className = "info-input";
    messageInput.id = "messageInput";
    messageInput.maxlength = 500;
    
    const sendButton = document.createElement("button");
    const sendIcon = document.createElement("img");
    sendIcon.src = "images/Vector.png";
    sendIcon.className = "send-icon";
    sendButton.appendChild(sendIcon);
    sendButton.className = "send-message-button";
    sendButton.addEventListener("click",  () => {
        sendMessage(messageInput)
        replyStatus = false;
        const msgInput = document.getElementById("messageInput");
        msgInput.placeholder = `Text here`;
    });

    const stickerButton = document.createElement("button");
    const stickerIcon = document.createElement("img");
    const stickerMenu = document.createElement("div");
    stickerMenu.className = "sticker-menu";
    const stickersDivText = document.createElement("p");
    stickersDivText.textContent = "Express yourself with custom stickers!";
    stickerMenu.appendChild(stickersDivText);
    const stickersDivStickersPackDiv = document.createElement("div");
    stickersDivStickersPackDiv.className = "stickers-pack-div";
    const stickerPacks = [
        {pack: "Sticker Pack 1"}, 
        {pack: "Sticker Pack 2"}
    ];
    let currentPack = 1;
    i = 1;
    const stickerPack1 = [
        {name: ":1_uzi_heart:", link: "images/stickers/sticker-pack-1-1.png"},
        {name: ":1_uzi_sad:", link: "images/stickers/sticker-pack-1-2.png"},
        {name: ":1_uzi_angry:", link: "images/stickers/sticker-pack-1-3.png"}
    ]
    const stickerPack2 = [
        {name: ":2_uzi_happy:", link: "images/stickers/sticker-pack-2-1.png"},
        {name: ":2_n_happy:", link: "images/stickers/sticker-pack-2-2.png"},
        {name: ":2_v_angry:", link: "images/stickers/sticker-pack-2-3.png"},
        {name: ":2_lizzy_on_phone_angry:", link: "images/stickers/sticker-pack-2-4.png"},
        {name: ":2_j_silly:", link: "images/stickers/sticker-pack-2-5.png"},
        {name: ":2_doll_serious:", link: "images/stickers/sticker-pack-2-6.png"},
        {name: ":2_thad_chill:", link: "images/stickers/sticker-pack-2-7.png"}
    ]
    const currentStickerPack = document.createElement("div");
    function renderPack(pack) {
        currentStickerPack.innerHTML = "";
        pack.forEach((link) => {
            const chooseSticker = document.createElement("img");
            chooseSticker.src = link.link;
            chooseSticker.className = "sticker";

            chooseSticker.addEventListener("click", () => {
                const messageInput = document.getElementById("messageInput");
                messageInput.value = link.name; 
            });

            currentStickerPack.appendChild(chooseSticker);
        });
    }   

    renderPack(stickerPack1);
    
    stickerPacks.forEach((pack, index) => {
        const packs = document.createElement("p");
        packs.textContent = pack.pack;
        packs.addEventListener("click", () =>{
            if (index === 0){
                renderPack(stickerPack1);
            } else if (index === 1){
                renderPack(stickerPack2);
            }
        })
        stickersDivStickersPackDiv.appendChild(packs);
    });
    stickerMenu.style.display = "none";
    stickerMenu.appendChild(stickersDivStickersPackDiv);
    stickerMenu.appendChild(currentStickerPack);
    stickerIcon.src = "images/icons/sticker.svg";
    stickerIcon.className = "send-icon";
    stickerButton.className = "send-message-button";
    let stickerMenuStatus = true;
    stickerButton.addEventListener("click", () => {
        stickerMenuStatus = !stickerMenuStatus;
        if (stickerMenuStatus) {
            stickerMenu.style.display = "none";
        } else {
            stickerMenu.style.display = "block";
        }
    });
    stickerButton.appendChild(stickerIcon);

    const uiDiv = document.createElement("div");
    uiDiv.appendChild(messageInput);
    uiDiv.appendChild(stickerButton);
    uiDiv.appendChild(sendButton);
    uiDiv.className = "chat-ui";
    globalChatDiv.appendChild(stickerMenu);
    globalChatDiv.appendChild(uiDiv);

    if (localStorage.getItem("status") === "muted" || localStorage.getItem("muteStatus") === "muted") {
        uiDiv.innerHTML = "";
    }

    

    main.appendChild(savedAccountDiv);
    main.appendChild(rulesAndSystemInfoDiv);
    main.appendChild(globalChatDiv);
    signInForm.style.animation = "fadeOut 0.7s forwards";
    setTimeout(() => {
        signInForm.style.display = "none";
        signInForm.style.animation = "none";
        globalChatDiv.style.animation = "fadeIn 0.7s forwards";
    }, 700);
    
}


function sendMessage(inputElement) {
  const message = inputElement.value.trim();
  if (!message) return;

  if (message.startsWith("/")) {
    const parts = message.split(" ");
    const command = parts[0].substring(1);
    let target = null;
    let value = null;

    if (command === "tell") {
      target = parts[1];
      value = parts.slice(2).join(" ").trim();
    } else if (command === "setrole") {
      target = parts.slice(1, -1).join(" ").trim();
      value = parts[parts.length - 1];
    } else if (command === "setpfp") {
      value = parts[1];
    } else {
      target = parts.slice(1).join(" ").trim() || null;
    }

    socket.emit("command", {
      username: localStorage.getItem("username"),
      token: localStorage.getItem("chatToken"),
      command,
      target,
      value
    });
  } else {
    const payload = {
      username: localStorage.getItem("username"),
      pfplink: localStorage.getItem("pfplink"),  
      role: localStorage.getItem("role"),
      messageId: crypto.randomUUID(),
      token: localStorage.getItem("chatToken"),
      message,
      replyTo: replyStatus ? {
        username: replyString[0],
        message: replyString[1]
      } : null,
      timeStamp: new Date().toISOString()
    };

    console.log(payload)
    socket.emit("chat message", payload);
    inputElement.value = "";
  }
}

    


document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage(document.getElementById("messageInput"));
        replyStatus = false;
        const msgInput = document.getElementById("messageInput");
        msgInput.placeholder = `Text here`;
        msgInput.value = ""
    }
});
