import React, { useState, useCallback, useMemo } from 'react';
import { generateGasScript, generateGasExplanation, ScriptType } from './services/geminiService';
import Spinner from './components/Spinner';
import { 
  SparklesIcon, CopyIcon, CheckIcon, CodeBracketIcon, ExclamationTriangleIcon, ArrowLeftIcon, 
  LightBulbIcon, BookOpenIcon, DocumentTextIcon, TableCellsIcon, ClipboardDocumentListIcon,
  CubeTransparentIcon, ServerStackIcon, CogIcon, // Added new icons
  PhotoIcon, EyeIcon, EyeSlashIcon // 画像・パスワード表示アイコンを追加
} from './components/Icons';

interface FeatureButton {
  id: string;
  label: string;
  description: string;
  promptExample: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  supportedScriptTypes?: ScriptType[]; // Optional: to filter features based on script type later
}

// コンテクスト履歴の型定義
interface ContextHistory {
  id: string;
  timestamp: Date;
  type: 'initial' | 'error_fix';
  prompt: string;
  generatedScript: string;
  explanation?: string;
  errorDescription?: string;
  errorImage?: string; // base64エンコードされた画像
}

// エラー修正データの型定義
interface ErrorFixData {
  errorDescription: string;
  errorImage?: File;
}

const COMMON_FEATURES: FeatureButton[] = [
  { id: 'line_bot', label: 'LINE Bot を作成', description: 'メッセージ応答など基本的なLINE Botを構築します。', promptExample: 'ユーザーが「こんにちは」と入力したら「ハロー！」と返すLINE BotのGASを作成してください。(Webhook URLはスクリプトプロパティで設定)', icon: CubeTransparentIcon, supportedScriptTypes: ['standalone', 'spreadsheet'] },
  { id: 'sheet_manipulation', label: 'スプレッドシート操作', description: 'データの読み書き、処理、整形などを行います。', promptExample: 'シート名「データ入力」のA列の値を読み取り、B列にその2倍の値を書き込むスクリプト。', icon: TableCellsIcon, supportedScriptTypes: ['standalone', 'spreadsheet'] },
  { id: 'gmail_automation', label: 'Gmail 自動化', description: 'メールの送信、受信処理、ラベル付けなどを自動化します。', promptExample: '件名に「重要」と含まれるメールを受信したら、自動で「確認事項」ラベルを付けてスターを付けるスクリプト。', icon: CogIcon, supportedScriptTypes: ['standalone', 'spreadsheet'] },
  { id: 'calendar_integration', label: 'カレンダー連携', description: '予定の作成、編集、取得などを自動化します。', promptExample: 'スプレッドシート「予定リスト」のB列の日付とC列の件名でGoogleカレンダーに予定を登録するスクリプト。', icon: CogIcon, supportedScriptTypes: ['standalone', 'spreadsheet'] },
  { id: 'drive_management', label: 'ドライブファイル管理', description: 'ファイルの作成、検索、移動、共有設定などを自動化します。', promptExample: 'Googleドライブの「レポート」フォルダ内に、今日の日付で新しいGoogleドキュメントを作成するスクリプト。', icon: ServerStackIcon, supportedScriptTypes: ['standalone', 'spreadsheet', 'form'] },
  { id: 'form_response_processing', label: 'フォーム回答処理', description: 'Googleフォームの回答をスプレッドシートに記録したり通知します。', promptExample: 'Googleフォームに新しい回答が送信されたら、その内容をスプレッドシート「回答一覧」に記録し、管理者にメールで通知するスクリプト。', icon: ClipboardDocumentListIcon, supportedScriptTypes: ['form', 'standalone'] },
  { id: 'web_api', label: 'Web API データ取得', description: '外部APIからデータを取得し、スプレッドシートなどに記録します。', promptExample: 'https://api.example.com/data からJSONデータを取得し、その中の「name」と「value」をスプレッドシート「APIデータ」に書き出すスクリプト。(APIキーはスクリプトプロパティで設定)', icon: CubeTransparentIcon, supportedScriptTypes: ['standalone', 'spreadsheet', 'form'] },
  { id: 'doc_generation', label: 'ドキュメント生成', description: 'テンプレートやデータに基づいてドキュメントを自動作成します。', promptExample: 'スプレッドシート「顧客リスト」の各行のデータを使って、顧客ごとに請求書ドキュメントを生成するスクリプト。', icon: DocumentTextIcon, supportedScriptTypes: ['standalone', 'spreadsheet'] },
  { id: 'chat_notification', label: 'チャット通知', description: 'Google Chatなどに通知を送信します。(Slackは別途ライブラリ等検討)', promptExample: 'スプレッドシート「売上」シートのA1セルの値が100を超えたら、Google Chatの特定のスペースに通知するスクリプト。(Webhook URLはスクリプトプロパティで設定)', icon: CogIcon, supportedScriptTypes: ['standalone', 'spreadsheet', 'form'] },
  { id: 'discord_notification', label: 'Discord通知', description: '特定のイベント発生時にDiscordチャンネルへWebhookで通知します。', promptExample: 'スプレッドシート「進捗管理」のA列のステータスが「完了」になったら、DiscordのWebhook URLに「タスク完了：[タスク名]」というメッセージを送信するGASを作成してください。(Webhook URLはスクリプトプロパティで設定)', icon: CubeTransparentIcon, supportedScriptTypes: ['standalone', 'spreadsheet', 'form'] },
  { id: 'custom_menu_spreadsheet', label: 'カスタムメニュー機能拡張 (スプレッドシート)', description: '既存のカスタムメニューにさらに機能を追加・編集します。', promptExample: '現在のスプレッドシートの「便利機能」というカスタムメニューに、「選択範囲の背景を黄色にする」機能を追加するスクリプト。', icon: TableCellsIcon, supportedScriptTypes: ['spreadsheet'] },
];

type ViewState = 'scriptTypeSelection' | 'featureSelection' | 'generate' | 'errorFix';

interface ScriptTypeChoice {
  id: ScriptType;
  label: string;
  description: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const SCRIPT_TYPE_CHOICES: ScriptTypeChoice[] = [
  { id: 'standalone', label: 'スタンドアロン スクリプト', description: '特定のファイルに紐付かない独立したスクリプト。Webアプリや汎用自動処理に。', icon: DocumentTextIcon },
  { id: 'spreadsheet', label: 'スプレッドシート連携スクリプト', description: 'Googleスプレッドシートに埋め込み、カスタムメニュー等で操作を拡張。', icon: TableCellsIcon },
  { id: 'form', label: 'Googleフォーム連携スクリプト', description: 'Googleフォームに埋め込み、送信時処理やフォーム操作を自動化。', icon: ClipboardDocumentListIcon },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('scriptTypeSelection');
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureButton | null>(null);
  const [promptText, setPromptText] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [explanation, setExplanation] = useState<string>('');
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState<boolean>(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [isExplanationCopied, setIsExplanationCopied] = useState<boolean>(false);

  // エラー修正機能用の新しい状態
  const [contextHistory, setContextHistory] = useState<ContextHistory[]>([]);
  const [errorFixData, setErrorFixData] = useState<ErrorFixData>({ errorDescription: '' });
  const [isFixingError, setIsFixingError] = useState<boolean>(false);
  const [currentIterationId, setCurrentIterationId] = useState<string>('');

  // APIキー管理用の新しい状態
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const clearAllOutputs = () => {
    setGeneratedScript('');
    setExplanation('');
    setError(null);
    setExplanationError(null);
    setIsCopied(false);
    setIsExplanationCopied(false);
  };

  // APIキー関連のハンドラー
  const validateApiKey = useCallback((key: string): boolean => {
    // Gemini APIキーの基本的なフォーマットチェック
    const apiKeyPattern = /^AIza[0-9A-Za-z_-]{35}$/;
    return apiKeyPattern.test(key.trim());
  }, []);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    setIsApiKeyValid(validateApiKey(newApiKey));
    if (error && error.includes('API')) {
      setError(null); // APIキー関連のエラーをクリア
    }
  }, [validateApiKey, error]);

  const handleApiKeySubmit = useCallback(() => {
    if (!isApiKeyValid) {
      setError('有効なGemini APIキーを入力してください。APIキーは「AIza」で始まる39文字の文字列です。');
      return;
    }
    // APIキーをローカルストレージに保存（オプション）
    try {
      localStorage.setItem('gemini_api_key', apiKey);
    } catch (e) {
      console.warn('ローカルストレージへの保存に失敗しました:', e);
    }
  }, [isApiKeyValid, apiKey]);

  const loadApiKeyFromStorage = useCallback(() => {
    try {
      const storedApiKey = localStorage.getItem('gemini_api_key');
      if (storedApiKey && validateApiKey(storedApiKey)) {
        setApiKey(storedApiKey);
        setIsApiKeyValid(true);
        return true;
      }
    } catch (e) {
      console.warn('ローカルストレージからの読み込みに失敗しました:', e);
    }
    return false;
  }, [validateApiKey]);

  // コンポーネントマウント時にAPIキーを読み込み
  React.useEffect(() => {
    loadApiKeyFromStorage();
  }, [loadApiKeyFromStorage]);

  // 新しいエラー修正機能用のハンドラー
  const generateIterationId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const saveToContextHistory = useCallback((
    type: 'initial' | 'error_fix',
    prompt: string,
    script: string,
    explanation?: string,
    errorDescription?: string,
    errorImage?: string
  ) => {
    const newEntry: ContextHistory = {
      id: generateIterationId(),
      timestamp: new Date(),
      type,
      prompt,
      generatedScript: script,
      explanation,
      errorDescription,
      errorImage
    };
    setContextHistory(prev => [...prev, newEntry]);
    setCurrentIterationId(newEntry.id);
  }, []);

  const handleErrorFixMode = useCallback(() => {
    if (!generatedScript) {
      setError('修正するスクリプトがありません。まずスクリプトを生成してください。');
      return;
    }
    
    // 現在の生成結果をコンテクストに保存
    saveToContextHistory('initial', promptText, generatedScript, explanation);
    setCurrentView('errorFix');
  }, [generatedScript, promptText, explanation, saveToContextHistory]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB制限
        setError('画像サイズは5MB以下にしてください。');
        return;
      }
      setErrorFixData(prev => ({ ...prev, errorImage: file }));
    }
  }, []);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const buildErrorFixPrompt = useCallback(async (errorData: ErrorFixData, context: ContextHistory[]): Promise<string> => {
    let prompt = `以下はこれまでのやり取りのコンテクストです：\n\n`;
    
    // コンテクスト履歴を追加
    context.forEach((entry, index) => {
      prompt += `【${index + 1}回目 - ${entry.type === 'initial' ? '初回生成' : 'エラー修正'}】\n`;
      prompt += `生成日時: ${entry.timestamp.toLocaleString()}\n`;
      prompt += `要求内容: ${entry.prompt}\n`;
      if (entry.errorDescription) {
        prompt += `エラー内容: ${entry.errorDescription}\n`;
      }
      prompt += `生成されたスクリプト:\n\`\`\`javascript\n${entry.generatedScript}\n\`\`\`\n\n`;
    });

    prompt += `【現在のエラー修正要求】\n`;
    prompt += `エラーの詳細: ${errorData.errorDescription}\n`;
    
    if (errorData.errorImage) {
      const base64Image = await convertImageToBase64(errorData.errorImage);
      prompt += `エラーのスクリーンショット: ${base64Image}\n`;
    }

    prompt += `\n上記のコンテクストとエラー情報を踏まえて、最新のスクリプトを修正してください。`;
    
    return prompt;
  }, []);

  const handleErrorFix = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!errorFixData.errorDescription.trim()) {
      setError('エラーの詳細を入力してください。');
      return;
    }
    if (!selectedScriptType) {
      setError('スクリプトタイプが設定されていません。');
      return;
    }

    setIsFixingError(true);
    clearAllOutputs();

    try {
      const fixPrompt = await buildErrorFixPrompt(errorFixData, contextHistory);
      const fixedScript = await generateGasScript(fixPrompt, selectedScriptType, apiKey);
      
      // 修正結果をコンテクストに保存
      const errorImageBase64 = errorFixData.errorImage ? await convertImageToBase64(errorFixData.errorImage) : undefined;
      saveToContextHistory(
        'error_fix',
        errorFixData.errorDescription,
        fixedScript,
        undefined,
        errorFixData.errorDescription,
        errorImageBase64
      );

      setGeneratedScript(fixedScript);
      // エラー修正データをリセット
      setErrorFixData({ errorDescription: '' });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setIsFixingError(false);
    }
  }, [errorFixData, selectedScriptType, contextHistory, buildErrorFixPrompt, saveToContextHistory]);

  const handleScriptTypeSelect = useCallback((scriptType: ScriptType) => {
    if (!isApiKeyValid) {
      setError('先にGemini APIキーを入力してください。');
      return;
    }
    setSelectedScriptType(scriptType);
    setCurrentView('featureSelection');
    clearAllOutputs();
    handleApiKeySubmit(); // APIキーを保存
  }, [isApiKeyValid, handleApiKeySubmit]);
  
  const handleFeatureSelect = useCallback((feature: FeatureButton) => {
    setSelectedFeature(feature);
    setPromptText(feature.promptExample || '');
    setCurrentView('generate');
    clearAllOutputs();
  }, []);

  const handleCustomPrompt = useCallback(() => {
    setSelectedFeature(null); 
    setPromptText('');
    setCurrentView('generate');
    clearAllOutputs();
  }, []);

  const handleBack = useCallback(() => {
    if (currentView === 'errorFix') {
      setCurrentView('generate');
      setErrorFixData({ errorDescription: '' });
    } else if (currentView === 'generate') {
      setCurrentView('featureSelection');
      setSelectedFeature(null);
    } else if (currentView === 'featureSelection') {
      setCurrentView('scriptTypeSelection');
      setSelectedScriptType(null);
    }
    clearAllOutputs();
    setPromptText(''); // Clear prompt text when going back
  }, [currentView]);


  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promptText.trim()) {
      setError('スクリプトの説明を入力してください。');
      return;
    }
    if (!selectedScriptType) {
      setError('スクリプトタイプが選択されていません。最初の画面に戻って選択してください。');
      return;
    }

    setIsLoading(true);
    clearAllOutputs();
    
    let finalPrompt = `ユーザーの要求： ${promptText}`;
    const scriptTypeJapanese = SCRIPT_TYPE_CHOICES.find(st => st.id === selectedScriptType)?.label || selectedScriptType;

    if (selectedFeature) {
      finalPrompt = `ユーザーは「${selectedFeature.label}」の機能（スクリプトタイプ：${scriptTypeJapanese}、V8ランタイム互換）を求めています。具体的な要件は以下の通りです：\n${promptText}`;
    } else {
      finalPrompt = `以下の要件でGoogle Apps Script (スクリプトタイプ：${scriptTypeJapanese}、V8ランタイム互換) を作成してください：\n${promptText}`;
    }

    try {
      const script = await generateGasScript(finalPrompt, selectedScriptType, apiKey);
      setGeneratedScript(script);
      
      // 初回生成時はコンテクスト履歴をクリアして新規保存
      setContextHistory([]);
      saveToContextHistory('initial', promptText, script);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  }, [promptText, selectedFeature, selectedScriptType]);

  const handleCopyCode = useCallback(async (contentToCopy: string, setCopiedState: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (!contentToCopy) return;
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError('内容をクリップボードにコピーできませんでした。');
    }
  }, []);

  const handleGenerateExplanation = useCallback(async () => {
    if (!generatedScript || !selectedScriptType) return;
    setIsGeneratingExplanation(true);
    setExplanationError(null);
    setExplanation('');
    try {
      const newExplanation = await generateGasExplanation(generatedScript, selectedScriptType, apiKey);
      setExplanation(newExplanation);
    } catch (err) {
      if (err instanceof Error) {
        setExplanationError(err.message);
      } else {
        setExplanationError('解説の生成中に予期しないエラーが発生しました。');
      }
    } finally {
      setIsGeneratingExplanation(false);
    }
  }, [generatedScript, selectedScriptType]);

  const pageTitle = useMemo(() => {
    if (currentView === 'generate') {
      return selectedFeature ? selectedFeature.label : "カスタム要件で生成";
    }
    if (currentView === 'featureSelection') {
      const type = SCRIPT_TYPE_CHOICES.find(st => st.id === selectedScriptType);
      return type ? `${type.label}の機能を選択` : "機能を選択";
    }
    return "GAS生成アシスタント";
  }, [currentView, selectedFeature, selectedScriptType]);
  
  const pageSubtitle = useMemo(() => {
    const typeLabel = SCRIPT_TYPE_CHOICES.find(st => st.id === selectedScriptType)?.label || "";
    if (currentView === 'generate') {
      if (selectedFeature) {
        return `「${selectedFeature.label}」(${typeLabel})のスクリプトを生成します。具体的な要件を教えてください。`;
      }
      return `カスタム要件で${typeLabel}のスクリプトを生成します。具体的な要件を教えてください。`;
    }
    if (currentView === 'featureSelection') {
      return `作成したい ${typeLabel} の一般的な機能を選ぶか、自分で要件を記述してください。`;
    }
    return "まず、作成したいGoogle Apps Scriptのタイプを選択してください。";
  }, [currentView, selectedFeature, selectedScriptType]);

  if (currentView === 'scriptTypeSelection') {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
        <header className="w-full max-w-4xl text-center my-8 md:my-12">
          <div className="flex items-center justify-center mb-3">
            <LightBulbIcon className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold text-blue-700">GAS生成アシスタント</h1>
          </div>
          <p className="text-gray-600 text-lg">{pageSubtitle}</p>
        </header>
        
        <main className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 md:p-8 space-y-8">
          {/* APIキー入力セクション */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
              <CogIcon className="h-6 w-6 mr-2" />
              Gemini API設定
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                  Gemini APIキー <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder="AIza... で始まる39文字のAPIキーを入力"
                    className={`w-full pr-12 pl-4 py-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150 ${
                      apiKey ? (isApiKeyValid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50') : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showApiKey ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                {apiKey && (
                  <div className="mt-2 flex items-center text-sm">
                    {isApiKeyValid ? (
                      <span className="text-green-600 flex items-center">
                        <CheckIcon className="h-4 w-4 mr-1" />
                        有効なAPIキー形式です
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        APIキー形式が正しくありません
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  APIキーは <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Google AI Studio</a> で無料取得できます。ローカルストレージに保存されます。
                </p>
              </div>
              
              {error && (
                <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2" role="alert">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* スクリプトタイプ選択セクション */}
          <div>
            <h2 className="text-2xl font-semibold text-blue-700 mb-6 text-center">スクリプトタイプを選択</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SCRIPT_TYPE_CHOICES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleScriptTypeSelect(type.id)}
                className="bg-gray-50 hover:bg-gray-200/80 p-6 rounded-lg shadow-md text-left transition-all duration-150 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white flex flex-col items-center text-center"
                aria-label={type.label}
              >
                <type.icon className="h-12 w-12 text-blue-600 mb-3 shrink-0" />
                <h3 className="text-lg font-semibold text-gray-700 mb-1">{type.label}</h3>
                <p className="text-sm text-gray-500">{type.description}</p>
              </button>
            ))}
            </div>
          </div>
        </main>
        <footer className="w-full max-w-4xl text-center text-gray-500 mt-8 md:mt-12 pb-8 text-sm">
          <p>Gemini APIを利用しています。上記にAPIキーを入力してご利用ください。</p>
          <p>&copy; {new Date().getFullYear()} AIスクリプトジェネレーター</p>
        </footer>
      </div>
    );
  }
  
  if (currentView === 'featureSelection') {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
        <header className="w-full max-w-4xl text-center my-8 md:my-12">
          <div className="relative flex items-center justify-center mb-3">
             <button 
                onClick={handleBack} 
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-blue-600"
                aria-label="戻る"
            >
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <div className="flex items-center justify-center">
              <LightBulbIcon className="h-10 w-10 md:h-12 md:w-12 text-blue-600 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-blue-700">{pageTitle}</h1>
            </div>
          </div>
          <p className="text-gray-600 text-lg">{pageSubtitle}</p>
        </header>

        <main className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-blue-700 mb-6 text-center">よく使う機能から選ぶ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {COMMON_FEATURES.filter(f => !f.supportedScriptTypes || f.supportedScriptTypes.includes(selectedScriptType!)).map((feature) => (
              <button
                key={feature.id}
                onClick={() => handleFeatureSelect(feature)}
                className="bg-gray-50 hover:bg-gray-200/80 p-4 rounded-lg shadow-md text-left transition-all duration-150 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                aria-label={feature.label}
              >
                <div className="flex items-center mb-2">
                  {feature.icon && <feature.icon className="h-6 w-6 text-blue-600 mr-3 shrink-0" />}
                  <h3 className="text-base font-semibold text-gray-700">{feature.label}</h3>
                </div>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </button>
            ))}
          </div>
          <div className="text-center">
             <button
                onClick={handleCustomPrompt}
                className="w-full md:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white transition-colors duration-150 group flex items-center justify-center"
              >
                <SparklesIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                または、自分で要件を記述する
            </button>
          </div>
        </main>
         <footer className="w-full max-w-4xl text-center text-gray-500 mt-8 md:mt-12 pb-8 text-sm">
            <p>Gemini APIを利用しています。上記にAPIキーを入力してご利用ください。</p>
            <p>&copy; {new Date().getFullYear()} AIスクリプトジェネレーター</p>
        </footer>
      </div>
    );
  }

  // Error Fix View
  if (currentView === 'errorFix') {
    return (
      <div className="min-h-screen bg-gray-100 text-gray-800 p-4">
        <header className="w-full max-w-7xl mx-auto my-6">
          <div className="relative flex items-center justify-center mb-2">
            <button 
              onClick={handleBack} 
              className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-blue-600"
              aria-label="戻る"
            >
              <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <div className="flex items-center justify-center">
              <ExclamationTriangleIcon className="h-10 w-10 md:h-12 md:w-12 text-orange-600 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-orange-700 text-center">
                エラー修正モード
              </h1>
            </div>
          </div>
          <p className="text-gray-600 text-lg text-center">エラーの詳細とスクリーンショットを入力して、スクリプトを修正します</p>
        </header>

        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：エラー入力エリア */}
          <div className="bg-white shadow-xl rounded-xl p-6">
            <h2 className="text-xl font-semibold text-orange-700 mb-4 flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              エラー情報の入力
            </h2>
            
            <form onSubmit={handleErrorFix} className="space-y-4">
              <div>
                <label htmlFor="errorDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  エラーの詳細説明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="errorDescription"
                  value={errorFixData.errorDescription}
                  onChange={(e) => setErrorFixData(prev => ({ ...prev, errorDescription: e.target.value }))}
                  placeholder="例：実行時に「ReferenceError: SpreadsheetApp is not defined」というエラーが発生しました。"
                  rows={6}
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-800 placeholder-gray-400"
                  disabled={isFixingError}
                  required
                />
              </div>

              <div>
                <label htmlFor="errorImage" className="block text-sm font-medium text-gray-700 mb-2">
                  エラーのスクリーンショット（任意）
                </label>
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="errorImage" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <PhotoIcon className="w-8 h-8 mb-2 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">クリックして画像をアップロード</span>
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG (最大5MB)</p>
                    </div>
                    <input
                      id="errorImage"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isFixingError}
                    />
                  </label>
                </div>
                {errorFixData.errorImage && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ {errorFixData.errorImage.name} が選択されました
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isFixingError || !errorFixData.errorDescription.trim()}
                className="w-full flex items-center justify-center px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-150"
              >
                {isFixingError ? (
                  <>
                    <Spinner /> <span className="ml-2">修正中...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    スクリプトを修正
                  </>
                )}
              </button>
            </form>

            {/* コンテクスト履歴表示 */}
            {contextHistory.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">これまでの履歴：</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {contextHistory.map((entry, index) => (
                    <div key={entry.id} className="text-xs bg-gray-50 p-2 rounded border">
                      <div className="font-medium text-gray-600">
                        {index + 1}. {entry.type === 'initial' ? '初回生成' : 'エラー修正'} - {entry.timestamp.toLocaleString()}
                      </div>
                      <div className="text-gray-500 truncate">{entry.prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右側：結果表示エリア */}
          <div className="bg-white shadow-xl rounded-xl p-6">
            <h2 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
              <CodeBracketIcon className="h-6 w-6 mr-2" />
              修正結果
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2 mb-4" role="alert">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {generatedScript ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-blue-700">修正されたスクリプト：</h3>
                  <button
                    onClick={() => handleCopyCode(generatedScript, setIsCopied)}
                    className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-blue-700 text-sm font-medium rounded-lg"
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="h-5 w-5 mr-2 text-green-600" /> コピー済み
                      </>
                    ) : (
                      <>
                        <CopyIcon className="h-5 w-5 mr-2" /> コピー
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-900 border border-gray-200 max-h-96" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0AEC0 #E2E8F0' }}>
                  <code>{generatedScript}</code>
                </pre>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleGenerateExplanation}
                    disabled={isGeneratingExplanation}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
                  >
                    {isGeneratingExplanation ? (
                      <>
                        <Spinner /> <span className="ml-2">解説生成中...</span>
                      </>
                    ) : (
                      <>
                        <BookOpenIcon className="h-5 w-5 mr-2" />
                        解説を生成
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setErrorFixData({ errorDescription: '' })}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                  >
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    さらに修正
                  </button>
                </div>

                {explanation && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-blue-700">解説：</h3>
                      <button
                        onClick={() => handleCopyCode(explanation, setIsExplanationCopied)}
                        className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-blue-700 text-sm font-medium rounded-lg"
                      >
                        {isExplanationCopied ? (
                          <>
                            <CheckIcon className="h-5 w-5 mr-2 text-green-600" /> コピー済み
                          </>
                        ) : (
                          <>
                            <CopyIcon className="h-5 w-5 mr-2" /> コピー
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap break-words text-sm text-gray-900 font-sans">{explanation}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <CodeBracketIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p>エラー情報を入力して「スクリプトを修正」ボタンを押してください。</p>
                <p className="text-sm mt-2">修正されたスクリプトがここに表示されます。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generate View - 左右分割レイアウトに変更
  return ( 
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4">
       <header className="w-full max-w-7xl mx-auto my-6">
         <div className="relative flex items-center justify-center mb-2">
            <button 
                onClick={handleBack} 
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500 hover:text-blue-600"
                aria-label="戻る"
            >
                <ArrowLeftIcon className="h-6 w-6"/>
            </button>
            <div className="flex items-center justify-center">
              <CodeBracketIcon className="h-10 w-10 md:h-12 md:w-12 text-blue-600 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-blue-700 text-center">
                {pageTitle}
              </h1>
            </div>
         </div>
         <p className="text-gray-600 text-lg text-center">{pageSubtitle}</p>
      </header>

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側：要件入力エリア */}
                 <div className="bg-white shadow-xl rounded-xl p-6">
           <h2 className="text-xl font-semibold text-blue-700 mb-4">要件の入力</h2>
           
           <form onSubmit={handleSubmit} className="space-y-6">
             <div>
               <label htmlFor="prompt" className="block text-sm font-medium text-blue-700 mb-1">
                 {selectedFeature ? `「${selectedFeature.label}」で実現したいことの詳細：` : '実現したいことの詳細：'}
               </label>
               <textarea
                 id="prompt"
                 value={promptText}
                 onChange={(e) => setPromptText(e.target.value)}
                 placeholder={selectedFeature?.promptExample || "例：'Googleドキュメントを作成し、そのリンクをrecipient@example.comにメールで送信する。ファイル名は「報告書-[今日の日付]」とする。'"}
                 rows={8}
                 className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-colors duration-150"
                 disabled={isLoading || isGeneratingExplanation}
                 aria-label="スクリプトの説明入力欄"
               />
             </div>
             <button
               type="submit"
               disabled={isLoading || isGeneratingExplanation || !promptText.trim()}
               className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 group"
               aria-live="polite"
             >
               {isLoading ? (
                 <>
                   <Spinner /> <span className="ml-2">スクリプト生成中...</span>
                 </>
               ) : (
                 <>
                   <SparklesIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                   スクリプトを生成
                 </>
               )}
             </button>
           </form>
           
           {error && (
             <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2 mt-4" role="alert">
               <ExclamationTriangleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
               <p className="text-sm">{error}</p>
             </div>
           )}
           
           {!generatedScript && !isLoading && !error && (
             <div className="text-center text-gray-500 py-8">
               <CodeBracketIcon className="h-16 w-16 mx-auto text-gray-400 mb-2" aria-hidden="true"/>
               <p>要件を入力して「スクリプトを生成」ボタンを押してください。</p>
             </div>
           )}
         </div>

         {/* 右側：結果表示エリア */}
         <div className="bg-white shadow-xl rounded-xl p-6">
           <h2 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
             <CodeBracketIcon className="h-6 w-6 mr-2" />
             生成結果
           </h2>

           {generatedScript && !isLoading ? (
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-blue-700">生成されたスクリプト：</h3>
                 <button
                   onClick={() => handleCopyCode(generatedScript, setIsCopied)}
                   className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-blue-700 text-sm font-medium rounded-lg"
                 >
                   {isCopied ? (
                     <>
                       <CheckIcon className="h-5 w-5 mr-2 text-green-600" /> コピー済み
                     </>
                   ) : (
                     <>
                       <CopyIcon className="h-5 w-5 mr-2" /> コピー
                     </>
                   )}
                 </button>
               </div>
               <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-900 border border-gray-200 max-h-96" style={{ scrollbarWidth: 'thin', scrollbarColor: '#A0AEC0 #E2E8F0' }}>
                 <code>{generatedScript}</code>
               </pre>
               
               <div className="flex flex-wrap gap-3">
                 <button
                   onClick={handleGenerateExplanation}
                   disabled={isGeneratingExplanation}
                   className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
                 >
                   {isGeneratingExplanation ? (
                     <>
                       <Spinner /> <span className="ml-2">解説生成中...</span>
                     </>
                   ) : (
                     <>
                       <BookOpenIcon className="h-5 w-5 mr-2" />
                       解説を生成
                     </>
                   )}
                 </button>
                 
                 <button
                   onClick={handleErrorFixMode}
                   className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg"
                 >
                   <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                   エラー修正
                 </button>
               </div>

               {explanationError && (
                 <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2" role="alert">
                   <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                   <p className="text-sm">{explanationError}</p>
                 </div>
               )}

               {explanation && !isGeneratingExplanation && (
                 <div className="mt-4 pt-4 border-t border-gray-200">
                   <div className="flex justify-between items-center mb-2">
                     <h3 className="text-lg font-semibold text-blue-700">解説：</h3>
                     <button
                       onClick={() => handleCopyCode(explanation, setIsExplanationCopied)}
                       className="flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-blue-700 text-sm font-medium rounded-lg"
                     >
                       {isExplanationCopied ? (
                         <>
                           <CheckIcon className="h-5 w-5 mr-2 text-green-600" /> コピー済み
                         </>
                       ) : (
                         <>
                           <CopyIcon className="h-5 w-5 mr-2" /> コピー
                         </>
                       )}
                     </button>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                     <pre className="whitespace-pre-wrap break-words text-sm text-gray-900 font-sans">{explanation}</pre>
                   </div>
                 </div>
               )}
             </div>
           ) : (
             <div className="text-center text-gray-500 py-12">
               <CodeBracketIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
               <p>スクリプトが生成されるとここに表示されます。</p>
               <p className="text-sm mt-2">左側で要件を入力して「スクリプトを生成」ボタンを押してください。</p>
             </div>
           )}
         </div>
       </div>
     </div>
   );
 };

 export default App;
