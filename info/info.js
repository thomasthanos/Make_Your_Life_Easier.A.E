// Navigation functionality
class InfoApp {
    constructor() {
        this.currentSection = 'install';
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupAnimations();
        this.setupScrollEffects();
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-button');
        
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const sectionId = e.currentTarget.dataset.section;
                this.showSection(sectionId);
            });
        });

        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.altKey) {
                switch(e.key) {
                    case '1':
                        this.showSection('install');
                        break;
                    case '2':
                        this.showSection('activate');
                        break;
                    case '3':
                        this.showSection('maintenance');
                        break;
                    case '4':
                        this.showSection('crack');
                        break;
                    case '5':
                        this.showSection('dlc');
                        break;
                    case '6':
                        this.showSection('password');
                        break;
                    case '7':
                        this.showSection('spicetify');
                        break;
                    case '8':
                        this.showSection('titus');
                        break;
                    case '9':
                        this.showSection('bios');
                        break;
                    case '0':
                        this.showSection('settings');
                        break;
                }
            }
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all buttons
        document.querySelectorAll('.nav-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            
            // Add active class to corresponding button
            const targetButton = document.querySelector(`[data-section="${sectionId}"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }

            this.currentSection = sectionId;
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Update browser history
            history.pushState({ section: sectionId }, '', `#${sectionId}`);
        }
    }

    setupAnimations() {
        // Add intersection observer for fade-in animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe feature cards
        document.querySelectorAll('.feature-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
    }

    setupScrollEffects() {
        let lastScrollTop = 0;
        const nav = document.querySelector('.nav');

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                nav.style.transform = 'translateY(-100%)';
            } else {
                // Scrolling up
                nav.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = scrollTop;
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.section) {
                this.showSection(e.state.section);
            }
        });

        // Check URL hash on load
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(hash)) {
            this.showSection(hash);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InfoApp();
});

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
    // Add click effects to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') return;
            
            // Create ripple effect
            const ripple = document.createElement('div');
            ripple.className = 'ripple';
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            
            const rect = card.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            card.style.position = 'relative';
            card.style.overflow = 'hidden';
            card.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add CSS for ripple effect
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        .feature-card {
            cursor: pointer;
            user-select: none;
        }
    `;
    document.head.appendChild(style);
});

// Add search functionality
document.addEventListener('DOMContentLoaded', () => {
    // Create search box (you can position it in your header)
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';
    searchBox.innerHTML = `
        <input type="text" placeholder="🔍 Αναζήτηση σελίδας..." class="search-input">
        <div class="search-results"></div>
    `;
    
    // Add search styles
    const searchStyles = `
        .search-box {
            position: relative;
            max-width: 300px;
            margin: 0 auto 2rem;
        }
        
        .search-input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 25px;
            color: var(--text-primary);
            font-size: 0.9rem;
            outline: none;
            transition: all 0.3s ease;
        }
        
        .search-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        
        .search-input::placeholder {
            color: var(--text-muted);
        }
        
        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            margin-top: 0.5rem;
            max-height: 300px;
            overflow-y: auto;
            display: none;
            z-index: 1000;
        }
        
        .search-result-item {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background 0.3s ease;
        }
        
        .search-result-item:hover {
            background: var(--bg-hover);
        }
        
        .search-result-item:last-child {
            border-bottom: none;
        }
        
        .search-highlight {
            background: var(--accent);
            color: black;
            padding: 0.1rem 0.2rem;
            border-radius: 3px;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = searchStyles;
    document.head.appendChild(styleSheet);
    
    // You can add the search box to your header if needed
    // document.querySelector('.header-content').appendChild(searchBox);
});

// Utility functions
const InfoUtils = {
    // Debounce function for search
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Format text with highlights
    highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    },

    // Smooth scroll to element
    scrollToElement(element, offset = 100) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InfoApp, InfoUtils };
}