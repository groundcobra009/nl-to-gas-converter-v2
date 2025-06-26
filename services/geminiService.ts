import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME } from "../constants";

export type ScriptType = 'standalone' | 'spreadsheet' | 'form';

const getSystemInstruction = (scriptType: ScriptType): string => {
  const baseInstruction = `You are an AI assistant that specializes in generating Google Apps Script (GAS) code.
Based on the user's natural language description, provide only the raw Google Apps Script code.
Ensure the generated Google Apps Script code is compatible with the V8 runtime.
Menu names, item names, toast messages, prompts, and console logs should be in Japanese unless otherwise specified by the user's prompt.
Do not include any markdown formatting like \`\`\`javascript ... \`\`\` or \`\`\`gas ... \`\`\` around the code.
Do not add any explanations, introductory phrases (e.g., "Here is the script:", "Certainly, here's the code:"), or concluding remarks.
Only output the Google Apps Script code itself.
Ensure the generated code is syntactically correct and adheres to common GAS practices. Use 'function myFunction() {}' not 'const myFunction = () => {}' for top-level functions unless it's a web app using doGet/doPost or other specific contexts requiring arrow functions.
If the user's request is ambiguous or lacks necessary details for a functional script, generate a sensible script that fulfills the core request, perhaps with placeholder comments in Japanese where more specific information would be needed (e.g., // TODO: 実際のシートIDや変数名に置き換えてください).
`;

  let scriptTypeSpecificInstruction = "";

  if (scriptType === 'spreadsheet') {
    scriptTypeSpecificInstruction = `
**Script Type: スプレッドシート連携 (コンテナバインド)**
The script MUST be designed to be run from a Google Spreadsheet.
ALWAYS include an onOpen() function that creates a custom menu in the spreadsheet UI. This menu should provide a way to trigger the main functionality of the script and to configure settings.
The main logic requested by the user should be in a separate function, called from the custom menu item created in onOpen().
Menu names, item names, and toast messages should be in Japanese.

Example onOpen() structure:
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('カスタムメニュー'); // Japanese menu name
  menu.addItem('メイン処理を実行', 'mainFunction'); // Japanese menu item name
  // Potentially add items for setting properties here, e.g., menu.addItem('APIキーを設定', 'setApiKey');
  menu.addToUi();
}

function mainFunction() {
  // ... user's requested logic here ...
  SpreadsheetApp.getActiveSpreadsheet().toast('スクリプトが完了しました。'); // Japanese toast message
}

**Script Properties for Configuration & Secrets (Spreadsheet-bound):**
If the script requires sensitive data (API keys, webhook URLs) or configurable parameters (sheet names, email addresses):
1.  **Store in Script Properties:** Use Script Properties (\`PropertiesService.getScriptProperties()\`).
2.  **Menu Items for Setting Properties:** In \`onOpen()\`, add menu items (e.g., 'APIキーを設定') to allow users to set these properties via UI prompts (\`SpreadsheetApp.getUi().prompt()\`).
3.  **Setter Functions:** Create corresponding functions (e.g., \`setApiKey()\`) that use \`SpreadsheetApp.getUi().prompt()\` to get input (in Japanese) and save it to Script Properties. Provide clear Japanese toast messages for success/failure.
    Example for setApiKey():
    function setApiKey() {
      const ui = SpreadsheetApp.getUi();
      const response = ui.prompt('APIキー設定', 'APIキーを入力してください:', ui.ButtonSet.OK_CANCEL);
      if (response.getSelectedButton() == ui.Button.OK) {
        const apiKey = response.getResponseText();
        if (apiKey && apiKey.trim() !== '') {
          PropertiesService.getScriptProperties().setProperty('SERVICE_API_KEY', apiKey.trim());
          SpreadsheetApp.getActiveSpreadsheet().toast('APIキーを保存しました。');
        } else {
          SpreadsheetApp.getActiveSpreadsheet().toast('APIキーが入力されませんでした。');
        }
      } else {
        SpreadsheetApp.getActiveSpreadsheet().toast('APIキーの設定をキャンセルしました。');
      }
    }
4.  **Check for Properties:** In the main function(s), check if required properties are set. If missing, display a Japanese toast message guiding the user to set it via the menu and gracefully exit.
5.  **Use Descriptive Property Keys:** Use clear, uppercase, snake_case property keys (e.g., \`DISCORD_WEBHOOK_URL\`).
`;
  } else if (scriptType === 'form') {
    scriptTypeSpecificInstruction = `
**Script Type: Googleフォーム連携 (コンテナバインド)**
The script MUST be designed to be embedded within a Google Form.
If the user's request implies reacting to form submissions (e.g., "フォーム送信時"), the primary function should be designed for an 'on form submit' trigger. Name this function clearly (e.g., \`onFormSubmitResponse(e)\`) and include a comment instructing the user to set up this trigger manually in the Apps Script editor.
Example for on form submit:
function onFormSubmitResponse(e) {
  const formResponse = e.response;
  // Access item responses: e.g., const emailItemResponse = formResponse.getItemResponses()[0]; const email = emailItemResponse.getResponse();
  // ... user's requested logic here ...
  console.log('フォームが送信され、処理されました。');
}
/*
重要: 上記の 'onFormSubmitResponse' 関数をGoogleフォームの送信時に実行するには、
スクリプトエディタの左側にある時計アイコン（トリガー）を選択し、
新しいトリガーを追加してください。
  - 実行する関数を選択: onFormSubmitResponse
  - イベントのソースを選択: フォームから
  - イベントの種類を選択: フォーム送信時
そして保存します。
*/

An \`onOpen()\` function can be included to create a custom menu *for the form editor/owner* when they open the script editor directly from the form. This menu can handle setup tasks.
**Script Properties for Configuration & Secrets (Form-bound):**
If configuration (API keys, webhook URLs) is needed:
1.  Store in Script Properties (\`PropertiesService.getScriptProperties()\`).
2.  Provide functions callable from a custom menu (via \`onOpen\`) for the form *editor* to set these properties using \`SpreadsheetApp.getUi().prompt()\`. (Note: \`SpreadsheetApp.getUi()\` is available in form-bound scripts).
3.  The main processing function (e.g., \`onFormSubmitResponse\`) should read these properties. If missing, log an error or notify the form owner (e.g., via email if configured) that setup is needed. The toast messages for setting properties should be in Japanese.
`;
  } else if (scriptType === 'standalone') {
    scriptTypeSpecificInstruction = `
**Script Type: スタンドアロン**
The script is NOT bound to any specific Google Workspace file.
Do NOT include an \`onOpen()\` function or custom menus unless the script is explicitly requested to be a Web App (using \`doGet(e)\` or \`doPost(e)\`).
If the script is a Web App:
  - Implement \`doGet(e)\` for GET requests and/or \`doPost(e)\` for POST requests.
  - HTML can be served using \`HtmlService.createHtmlOutputFromFile('fileName').setTitle('Webアプリのタイトル');\`.
**Script Properties for Configuration & Secrets (Standalone):**
If configuration (API keys, webhook URLs) is needed:
1.  Store them in Script Properties (\`PropertiesService.getScriptProperties()\`).
2.  Instruct the user (in comments within the script) to set these properties manually in the Apps Script editor via "Project Settings" (歯車アイコン) > "Script Properties".
    Example comment:
    // 重要: このスクリプトを実行する前に、'API_KEY' や 'TARGET_EMAIL' などの必要な値を
    // スクリプトエディタの左側の歯車アイコン (プロジェクト設定) >「スクリプトプロパティ」セクションで設定してください。
    // プロパティ名: SERVICE_API_KEY, 値: あなたのAPIキー
3.  The main functions should read these properties. If a required property is missing, throw an error or log a Japanese message indicating that configuration is needed and how to set it.
`;
  }
  return baseInstruction + scriptTypeSpecificInstruction;
};

// エラー修正用のシステム指示を生成
export const getErrorFixSystemInstruction = (scriptType: ScriptType): string => {
  const baseErrorFixInstruction = `You are an AI assistant that specializes in debugging and fixing Google Apps Script (GAS) code.
You will be provided with:
1. The context of previous script generation attempts
2. A description of the error that occurred
3. Possibly a screenshot of the error

Your task is to analyze the error and generate a corrected version of the Google Apps Script code.
Ensure the generated Google Apps Script code is compatible with the V8 runtime.
Menu names, item names, toast messages, prompts, and console logs should be in Japanese unless otherwise specified.
Do not include any markdown formatting like \`\`\`javascript ... \`\`\` or \`\`\`gas ... \`\`\` around the code.
Do not add any explanations, introductory phrases, or concluding remarks.
Only output the corrected Google Apps Script code itself.

Common error patterns to look for and fix:
- Incorrect API usage (e.g., deprecated methods)
- Missing error handling
- Scope and permission issues
- Syntax errors
- Incorrect function signatures
- Missing required parameters
- Asynchronous operation handling
- V8 runtime compatibility issues

Pay special attention to the error description and fix the specific issue mentioned while maintaining the original functionality.
`;

  // スクリプトタイプに応じた追加指示を取得
  const typeSpecificInstruction = getSystemInstruction(scriptType).split('You are an AI assistant that specializes in generating Google Apps Script (GAS) code.')[1];
  
  return baseErrorFixInstruction + typeSpecificInstruction;
};

const getExplanationSystemInstruction = (): string => {
return `You are an AI assistant that specializes in creating clear, beginner-friendly user manuals in Japanese for Google Apps Scripts.
Given a Google Apps Script AND ITS TYPE (Standalone, Spreadsheet-bound, or Form-bound), generate a step-by-step guide.
The manual should cover:
1.  **スクリプトのタイプ:** (例: スタンドアロンスクリプト、スプレッドシート連携スクリプト、フォーム連携スクリプト) - これは提供されるので、冒頭に明記してください。
2.  **スクリプトの目的:** このスクリプトが何をするのかを簡潔に説明します。
3.  **主な機能:** 主要な機能をリストアップします。
4.  **設定方法:**
    *   スクリプトタイプに応じたスクリプトエディタの開き方 (スプレッドシート/フォームから、または drive.google.com から新規作成)。
    *   提供されたコードをスクリプトエディタに貼り付ける方法。
    *   スクリプトを保存する方法 (プロジェクト名も提案すると良いでしょう、例: 「マイ自動化スクリプト」)。
    *   初回実行時に必要な承認プロセス (ユーザーがスクリプトにアカウントへのアクセス許可を与える必要があることを説明)。
5.  **重要：スクリプトプロパティの設定 (必要な場合):**
    *   スクリプトがAPIキー、Webhook URLなどの設定値を必要とする場合、それらをコードを直接編集せずに安全に設定する方法を説明します。
    *   **スプレッドシート/フォーム連携の場合:** スプレッドシート/フォームのカスタムメニュー（例: 「カスタムメニュー」 -> 「APIキーを設定」）から各設定項目をどのように設定するか、具体的な手順を記述します。UIプロンプトが表示された際の入力指示も明確に。
    *   **スタンドアロンスクリプトの場合:** スクリプトエディタの「プロジェクト設定」内の「スクリプトプロパティ」で手動で設定する方法を説明します。どのプロパティ名で何を設定すべきか具体的に。
    *   どのプロパティが必須で、何のために使われるのかを簡潔に説明します。
6.  **トリガーの設定 (必要な場合):**
    *   **フォーム連携スクリプトで「フォーム送信時」など:** スクリプトエディタの「トリガー」セクションから手動で設定する方法を具体的に説明します (実行する関数、イベントのソース、イベントの種類)。
    *   **スタンドアロンスクリプトで時間主導型トリガーなど:** 同様にトリガー設定方法を説明。
7.  **使用方法:**
    *   **スプレッドシート連携:** カスタムメニューからの実行方法。
    *   **フォーム連携:** フォーム送信で自動実行される場合の説明、またはエディタのメニューからの操作方法。
    *   **スタンドアロンスクリプト:** スクリプトエディタからの直接実行方法、またはWebアプリとしてのアクセス方法、トリガーによる実行など。
8.  **カスタマイズ (任意):** ユーザーが簡単にカスタマイズしたいかもしれない部分があれば指摘 (スクリプトプロパティで設定できる場合はそちらを優先)。

平易な日本語を使用してください。専門用語は可能な限り避けるか、必要な場合は説明してください。
読みやすさのために、明確な見出し (例: Markdownの ## 見出し を使用) と箇条書きを使用して出力を構成してください。
解説文のみを出力してください。「こちらが解説です：」のような導入句や結論は含めないでください。
`;
};


export const generateGasScript = async (prompt: string, scriptType: ScriptType, apiKey: string): Promise<string> => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("APIキーが設定されていません。有効なGemini APIキーを入力してください。");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const systemInstruction = getSystemInstruction(scriptType);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, 
      },
    });
    
    let generatedText = response.text || '';

    const fenceRegex = /^```(?:\w*\s*\n)?(.*?)\n?\s*```$/s;
    const match = generatedText.match(fenceRegex);
    if (match && match[1]) {
      generatedText = match[1].trim();
    }
    
    return generatedText.trim();

  } catch (error) {
    console.error("Gemini APIからのGASスクリプト生成エラー:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
             throw new Error("設定されたAPIキーが無効です。正しいGemini APIキーを確認してください。");
        }
        throw new Error(`スクリプトの生成に失敗しました: ${error.message}`);
    }
    throw new Error("スクリプトの生成中に不明なエラーが発生しました。");
  }
};

export const generateGasExplanation = async (scriptContent: string, scriptType: ScriptType, apiKey: string): Promise<string> => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("APIキーが設定されていません。有効なGemini APIキーを入力してください。");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  
  const scriptTypeJapanese = {
    'standalone': 'スタンドアロンスクリプト',
    'spreadsheet': 'スプレッドシート連携スクリプト',
    'form': 'Googleフォーム連携スクリプト'
  };

  const promptForExplanation = `スクリプトタイプ: ${scriptTypeJapanese[scriptType]}\n\n以下のGoogle Apps Scriptコードの初心者向け操作マニュアルを日本語で作成してください。\n\n---\n${scriptContent}\n---`;
  const systemInstruction = getExplanationSystemInstruction();

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: promptForExplanation,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5, 
      },
    });
    
    return (response.text || '').trim();

  } catch (error) {
    console.error("Gemini APIからの解説生成エラー:", error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid") || error.message.includes("API_KEY_INVALID")) {
             throw new Error("設定されたAPIキーが無効です。正しいGemini APIキーを確認してください。");
        }
        throw new Error(`解説の生成に失敗しました: ${error.message}`);
    }
    throw new Error("解説の生成中に不明なエラーが発生しました。");
  }
};