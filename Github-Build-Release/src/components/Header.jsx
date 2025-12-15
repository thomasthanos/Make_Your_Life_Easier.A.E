import React from 'react';
import { FaGithub, FaSun, FaMoon, FaPaintBrush } from 'react-icons/fa';

function Header({ activeTab, theme, toggleTheme }) {
  const getTabTitle = () => {
    switch(activeTab) {
      case 'create': return 'Create New Release';
      case 'history': return 'Release History';
      case 'logs': return 'Build Console';
      default: return '';
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Left - Brand and Theme Toggle */}
        <div className="brand-section">
          <div className="brand-logo">
            <FaGithub size={14} className="logo-icon" />
            <span className="brand-text">Release<span className="brand-highlight">Flow</span></span>
          </div>
          
          <button 
            className="theme-toggle-with-icon" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <FaPaintBrush size={12} className="theme-icon" />
            {theme === 'dark' ? <FaSun size={11} /> : <FaMoon size={11} />}
          </button>
        </div>

        {/* Center Title */}
        <div className="header-center">
          {getTabTitle()}
        </div>

        {/* Right - Empty for now */}
        <div className="header-actions">
        </div>
      </div>
    </header>
  );
}

export default Header;
