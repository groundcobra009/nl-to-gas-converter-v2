# 🪄 Natural Language to Google Apps Script Generator

AI-powered tool that converts natural language descriptions into Google Apps Script code using Gemini API. Features include error fixing with screenshot upload, multiple script types support, and real-time code generation with explanations.

![Demo Screenshot](https://via.placeholder.com/800x400/1E40AF/FFFFFF?text=Natural+Language+to+GAS+Generator)

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/groundcobra009/nl-to-gas-converter-v2)

**Live Demo:** Coming soon...

## ✨ Features

- **Natural Language to GAS Code Conversion**: Simply describe what you want in plain language
- **Error Fixing with Image Upload**: Upload error screenshots for AI-powered debugging  
- **Multiple Script Types Support**: 
  - Standalone Scripts
  - Spreadsheet-connected Scripts
  - Google Form Scripts
- **Real-time Validation and Explanations**: Get detailed explanations of generated code
- **User-friendly Wizard Interface**: Step-by-step guided experience
- **Secure API Key Management**: Client-side API key storage with validation

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS
- **Icons**: Custom SVG components

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/groundcobra009/nl-to-gas-converter-v2.git
cd nl-to-gas-converter-v2
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

5. Enter your Gemini API key in the interface and start generating scripts!

## 🎯 How to Use

1. **Enter API Key**: Input your Gemini API key in the settings section
2. **Choose Script Type**: Select from Standalone, Spreadsheet, or Form scripts
3. **Select Feature or Custom**: Pick a common feature or describe your requirements
4. **Generate**: AI creates your Google Apps Script code
5. **Fix Errors**: Upload error screenshots for automated debugging

## 📁 Project Structure

```
natural-language-to-gas/
├── src/
│   ├── components/          # React components
│   │   ├── Icons.tsx       # Custom SVG icons
│   │   └── Spinner.tsx     # Loading spinner
│   ├── services/           # API services
│   │   └── geminiService.ts # Gemini AI integration
│   ├── App.tsx             # Main application component
│   └── index.tsx           # Entry point
├── public/                 # Static assets
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

This application uses client-side API key input for security and ease of deployment. No server-side environment variables are required.

### API Key Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Enter the API key in the application interface
4. The key will be stored locally in your browser

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) for powering the code generation
- [Tailwind CSS](https://tailwindcss.com/) for the beautiful UI
- [React](https://react.dev/) for the frontend framework

## 📧 Contact

- GitHub: [@groundcobra009](https://github.com/groundcobra009)
- Repository: [nl-to-gas-converter-v2](https://github.com/groundcobra009/nl-to-gas-converter-v2)

---

⭐ If you find this project helpful, please give it a star!
