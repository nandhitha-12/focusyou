function toggleChat(){

    const chat =
    document.getElementById(
    "chatContainer"
    );

    if(chat.style.display === "flex"){

        chat.style.display = "none";

    }

    else{

        chat.style.display = "flex";

    }
}

function sendMessage(){

    let input =
    document.getElementById(
    "userInput"
    );

    let chatBody =
    document.getElementById(
    "chatBody"
    );

    let userText = input.value;

    if(userText.trim() === "")
    return;

    // USER MESSAGE

    let userMessage =
    document.createElement("div");

    userMessage.className =
    "user-message";

    userMessage.innerText =
    userText;

    chatBody.appendChild(
    userMessage
    );

    // BOT REPLY

    let botMessage =
    document.createElement("div");

    botMessage.className =
    "bot-message";

    botMessage.innerText =
    "Keep going! You're doing amazing ✨";

    chatBody.appendChild(
    botMessage
    );

    input.value = "";

    chatBody.scrollTop =
    chatBody.scrollHeight;
}