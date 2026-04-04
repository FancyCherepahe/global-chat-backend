const morePfp = document.querySelector("#stock-pfp-choose");
const signInForm = document.querySelector(".sign-in-form");

const allPfp = [{link: "images/stock-pfp/uzi-pfp.png", text: "UZI", text_color: "#080741", id: 1},
                {link: "images/stock-pfp/n-pfp.png", text: "SD-N", text_color: "#51FF00", id: 2},
                {link: "images/stock-pfp/v-pfp.png", text: "SD-V", text_color: "#00FFF2", id: 3},
                {link: "images/stock-pfp/cyn-pfp.png", text: "Cynessa", text_color: "#473965", id: 4},
                {link: "images/stock-pfp/lizzie-pfp.png", text: "Lizzie", text_color: "#E695C3", id: 5},
                {link: "images/stock-pfp/doll-pfp.png", text: "Doll", text_color: "#FF0000", id: 6},
                {link: "images/stock-pfp/absolute-solver-pfp.png", text: "Absolute Solver", text_color: "linear-gradient(90deg, #9F43A1 0%, #FF0000 100%)", id: 7}]



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
        document.body.appendChild(allPfpCanvas);
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
function saveUserData() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const pfpLink = morePfp.src;
    if (username && password) {
        localStorage.setItem("username", username);
        localStorage.setItem("password", password);
        localStorage.setItem("pfpLink", pfpLink);
        alert("Account created successfully!");
    } else {
        alert("Please fill in all fields.");
    }
    
}

function signInLastSavedAccount() {
    const savedUsername = localStorage.getItem("username");
    const savedPassword = localStorage.getItem("password");
    const savedPfpLink = localStorage.getItem("pfpLink");
    if (savedUsername && savedPassword) {
        usernameInput.value = savedUsername;
        passwordInput.value = savedPassword;
        morePfp.src = savedPfpLink;
        morePfp.id = localStorage.getItem("pfpId");
        alert("Signed in as: " + savedUsername);
    } else {
        alert("No saved username or password found.");
    }
}

function showGlobalChat() {
    const allMessagesDiv = document.createElement("ul");
    allMessagesDiv.className = "all-messages";
    
    const savedAccountDiv = document.createElement("div");
    savedAccountDiv.className = "account-info";
    const savedUsername = document.createElement("h1");
    savedUsername.textContent = localStorage.getItem("username");
    savedUsername.className = "account-username";
    savedAccountDiv.appendChild(savedUsername);
    const savedPfp = document.createElement("img");    
    savedPfp.className = "account-pfp";
    savedPfp.src = localStorage.getItem("pfpLink");
    savedAccountDiv.appendChild(savedPfp);
    const globalChatDiv = document.createElement("div");
    globalChatDiv.className = "global-chat";
    globalChatDiv.appendChild(allMessagesDiv);
    
    const messageInput = document.createElement("input");
    messageInput.type = "text";
    messageInput.placeholder = "Type here";
    messageInput.className = "info-input";
    messageInput.id = "messageInput";
    
    const sendButton = document.createElement("button");
    const sendIcon = document.createElement("img");
    sendIcon.src = "images/Vector.png";
    sendIcon.className = "send-icon";
    sendButton.appendChild(sendIcon);
    sendButton.className = "send-message-button";
    sendButton.addEventListener("click",  () => sendMessage(messageInput));

    const uiDiv = document.createElement("div");
    uiDiv.appendChild(messageInput);
    uiDiv.appendChild(sendButton);
    uiDiv.className = "chat-ui";
    globalChatDiv.appendChild(uiDiv);

    

    document.body.appendChild(savedAccountDiv);
    document.body.appendChild(globalChatDiv);
    signInForm.style.animation = "fadeOut 0.7s forwards";
    setTimeout(() => {
        signInForm.style.display = "none";
        signInForm.style.animation = "none";
        globalChatDiv.style.animation = "fadeIn 0.7s forwards";
    }, 700);

    socket.on("chat message", (msg) => {
  const li = document.createElement("li");
  li.textContent = msg;
  document.getElementById("messages").appendChild(li);
});

}

const socket = io("https://global-chat-backend-9oz2.onrender.com");

function sendMessage(inputElement) {
    const message = inputElement.value.trim();
    
        socket.emit("sendMessage", message);
    
}