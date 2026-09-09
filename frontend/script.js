document.addEventListener('DOMContentLoaded', () => {
    /**
     * =================================================================
     * INITIALIZATION
     * =================================================================
     * All scripts are initialized here to ensure the DOM is fully loaded.
     */
    initMobileNav();
    initTemplateCarousel();
    initMatchingCollectionTemplates();
    initHeaderScroll();
    initScrollAnimations();
    initTimelineScroll();
    initViewAllTemplatesButton();
    initFaqAccordion();
    initLoginPage(); // New: Initialize login page specific scripts
    initScrollSpy();
    initContractorFeedback();
});

function initContractorFeedback() {
    const form = document.getElementById('contractor-feedback-form');
    const message = document.getElementById('contractor-feedback-message');
    if (!form || !message) return;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));
        submitButton.disabled = true;
        message.textContent = 'Sending...';
        try {
            const baseUrl = window.FALSEQUOTE_API_URL || (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);
            const response = await fetch(`${baseUrl}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Unable to send your feedback.');
            form.reset();
            message.textContent = 'Thank you. Your feedback was sent to the FalseQuote team.';
        } catch (error) {
            message.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });
}

function initMatchingCollectionTemplates() {
    const extraShowcases = document.querySelectorAll('.explore-templates__item--custom .quotation-document-showcase');
    const quotationSource = document.querySelector('.explore-templates__grid > .explore-templates__item:not(.explore-templates__item--custom) .quotation-document');
    const invoiceSource = document.querySelector('.explore-templates__grid > .explore-templates__item:not(.explore-templates__item--custom) .invoice-document');

    if (extraShowcases.length !== 2 || !quotationSource || !invoiceSource) return;

    [quotationSource, invoiceSource].forEach((source, index) => {
        extraShowcases[index].replaceChildren(source.cloneNode(true));
        const documentElement = extraShowcases[index].firstElementChild;
        const companyName = documentElement?.querySelector('.invoice-header__company-name');
        const logo = documentElement?.querySelector('.invoice-header__logo');

        if (companyName) companyName.textContent = 'HAFEEZ INTERIOR POP';
        if (logo) {
            logo.outerHTML = `
                <svg class="invoice-header__logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="HK logo">
                    <rect width="100" height="100" rx="16" fill="var(--quote-text-dark, #0A2342)" />
                    <path d="M24 23V77M24 50H49M49 23V77" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" />
                    <path d="M67 23V77M67 52L87 23M67 52L88 77" fill="none" stroke="var(--quote-accent-gold, #D4AF37)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
                </svg>`;
        }
    });

    document.querySelectorAll('.explore-templates__grid .quotation-document').forEach(documentElement => {
        if (documentElement.querySelector('.collection-payment-qr')) return;
        const paymentBlock = document.createElement('div');
        paymentBlock.className = 'collection-payment-qr quote-qr-card';
        paymentBlock.innerHTML = `
            <img class="quote-qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi%3A%2F%2Fpay%3Fpa%3Duser%40upi%26pn%3DUser%26cu%3DINR" alt="Payment QR code">
            <div class="quote-qr-info">
                <strong>Payment Received Here</strong>
                <span>UPI ID: user@upi</span>
                <span>Payee Name: User</span>
            </div>`;
        const bottomSection = documentElement.querySelector('.quote-bottom-section');
        const signatureBox = bottomSection?.querySelector('.quote-signature-box');
        if (bottomSection && signatureBox) {
            const paymentRow = document.createElement('div');
            paymentRow.className = 'quote-payment-signature-row';
            signatureBox.replaceWith(paymentRow);
            paymentRow.append(paymentBlock, signatureBox);
        } else {
            documentElement.querySelector('footer')?.before(paymentBlock);
        }
    });

    document.querySelectorAll('.explore-templates__grid .invoice-document').forEach(documentElement => {
        if (documentElement.querySelector('.collection-payment-qr')) return;
        const paymentBlock = document.createElement('div');
        paymentBlock.className = 'collection-payment-qr invoice-upi-payment';
        paymentBlock.innerHTML = `
            <img class="invoice-upi-payment__qr" src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi%3A%2F%2Fpay%3Fpa%3Duser%40upi%26pn%3DUser%26cu%3DINR" alt="Payment QR code">
            <div class="invoice-upi-payment__details">
                <strong>Payment Received Here</strong>
                <span>UPI ID: user@upi</span>
                <span>Payee Name: User</span>
            </div>`;
        const note = documentElement.querySelector('.invoice-note');
        const paymentDetails = note?.querySelector('.invoice-payment-details');
        if (note && paymentDetails) {
            const paymentRow = document.createElement('div');
            paymentRow.className = 'invoice-note-payment-row';
            paymentDetails.replaceWith(paymentRow);
            paymentRow.append(paymentDetails, paymentBlock);
        } else {
            documentElement.querySelector('footer')?.before(paymentBlock);
        }
    });
}

/**
 * =================================================================
 * MOBILE NAVIGATION
 * =================================================================
 */
function initMobileNav() {
    const navMenu = document.getElementById('nav-menu'); // The drawer
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');
    const navOverlay = document.getElementById('nav-overlay');
    const mobileLinks = document.querySelectorAll('.nav__link--mobile');

    if (!navMenu || !navToggle || !navClose || !navOverlay) return;

    const openMenu = () => {
        navMenu.classList.add('is-open');
        navOverlay.classList.add('is-open');
        document.body.classList.add('mobile-menu-open');
    };

    const closeMenu = () => {
        navMenu.classList.remove('is-open');
        navOverlay.classList.remove('is-open');
        document.body.classList.remove('mobile-menu-open');
    };

    navToggle.addEventListener('click', openMenu);
    navClose.addEventListener('click', closeMenu);
    navOverlay.addEventListener('click', closeMenu);
    mobileLinks.forEach(link => link.addEventListener('click', closeMenu));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
            closeMenu();
        }
    });
}

/**
 * =================================================================
 * TEMPLATES CAROUSEL
 * =================================================================
 */
function initTemplateCarousel() {
    // --- 0. ELEMENT SELECTION & GUARD CLAUSE ---
    const carousel = document.getElementById('template-carousel');
    const paginationContainer = document.getElementById('carousel-pagination');
    const nextButton = document.getElementById('carousel-btn-right');
    const prevButton = document.getElementById('carousel-btn-left');

    // If the carousel doesn't exist on the page, stop running the script.
    if (carousel && paginationContainer && nextButton && prevButton) {
         const totalItems = 10;
        let currentIndex = 0;
        let autoSlideInterval;
        
        let items;
        let dots;

        function initializeCarousel() {
            // Get existing items from HTML and detach them temporarily
            const existingItems = Array.from(carousel.children);
            carousel.innerHTML = '';

            for (let i = 0; i < totalItems; i++) {
                let item;
                // If we have a pre-defined item for this index, use it. Otherwise, create a placeholder.
                if (existingItems[i]) {
                    item = existingItems[i];
                } else {
                    item = document.createElement('div');
                    item.className = 'carousel__item';
                    const color = i % 2 === 0 ? '3A8BFF' : 'A13AFF';
                    item.innerHTML = `<img src="https://placehold.co/400x560/${color}/FFFFFF?text=Template+${i + 1}" alt="Template ${i + 1}" loading="lazy">`;
                }
                carousel.appendChild(item);
                
                item.addEventListener('click', () => {
                    goToItem(i);
                    resetAutoSlide();
                });

                const dot = document.createElement('button');
                dot.className = 'carousel__dot';
                dot.setAttribute('aria-label', `Go to template ${i + 1}`);
                dot.addEventListener('click', () => {
                    goToItem(i);
                    resetAutoSlide();
                });
                paginationContainer.appendChild(dot);
            }

            items = carousel.children;
            dots = paginationContainer.children;

            updateCarousel();
            startAutoSlide();
        }

        function updateCarousel() {
            if (!items || !items.length) return;
            const isMobile = window.matchMedia('(max-width: 767px)').matches;

            for (let i = 0; i < totalItems; i++) {
                const item = items[i];
                const dot = dots[i];

                let offset = i - currentIndex;
                if (offset < -totalItems / 2) offset += totalItems;
                if (offset > totalItems / 2) offset -= totalItems;

                item.classList.remove('is-active', 'is-near', 'is-far', 'is-hidden');
                dot.classList.remove('is-active');

                let baseTransform = 'translate(-50%, -50%)';
                let additionalTransform = `translateX(${offset * 35}%) scale(0.4) rotateY(${offset > 0 ? -45 : 45}deg)`;

                let opacity = '0';
                let zIndex = '1';
                let filter = 'blur(5px)';

                if (isMobile) {
                    let mobileTransform = 'translateX(0) translateY(42px) scale(.58) rotateZ(0deg)';
                    let mobileOpacity = '0';
                    let mobileZIndex = '1';
                    let mobileFilter = 'blur(3px)';

                    if (offset === 0) {
                        item.classList.add('is-active');
                        dot.classList.add('is-active');
                        mobileTransform = 'translateX(0) translateY(0) scale(1) rotateZ(0deg)';
                        mobileOpacity = '1';
                        mobileZIndex = '6';
                        mobileFilter = 'blur(0)';
                    } else if (offset === 1 || offset === -1) {
                        item.classList.add('is-near');
                        const direction = offset > 0 ? 1 : -1;
                        mobileTransform = `translateX(${direction * 39}%) translateY(14px) scale(.78) rotateZ(${direction * 4}deg)`;
                        mobileOpacity = '.72';
                        mobileZIndex = '5';
                        mobileFilter = 'blur(.7px)';
                    } else if (offset === 2 || offset === -2) {
                        item.classList.add('is-far');
                        const direction = offset > 0 ? 1 : -1;
                        mobileTransform = `translateX(${direction * 67}%) translateY(28px) scale(.6) rotateZ(${direction * 8}deg)`;
                        mobileOpacity = '.28';
                        mobileZIndex = '4';
                        mobileFilter = 'blur(2px)';
                    } else {
                        item.classList.add('is-hidden');
                    }

                    item.style.transform = `translate(-50%, -50%) ${mobileTransform}`;
                    item.style.opacity = mobileOpacity;
                    item.style.zIndex = mobileZIndex;
                    item.style.filter = mobileFilter;
                    continue;
                }

                if (offset === 0) {
                    item.classList.add('is-active');
                    dot.classList.add('is-active');
                    additionalTransform = 'translateX(0) scale(1) rotateY(0deg)';
                    opacity = '1';
                    zIndex = '5';
                    filter = 'blur(0px)';
                } else if (offset === 1 || offset === -1) {
                    item.classList.add('is-near');
                    const side = offset > 0 ? 'right' : 'left';
                    const xPos = side === 'right' ? (isMobile ? '32%' : '40%') : (isMobile ? '-32%' : '-40%');
                    const rotation = side === 'right' ? (isMobile ? -28 : -35) : (isMobile ? 28 : 35);
                    additionalTransform = `translateX(${xPos}) scale(${isMobile ? '.56' : '.8'}) rotateY(${rotation}deg)`;
                    opacity = isMobile ? '.82' : '1';
                    zIndex = '4';
                    filter = isMobile ? 'blur(1px)' : 'blur(2px)';
                } else if (offset === 2 || offset === -2) {
                    item.classList.add('is-far');
                    const side = offset > 0 ? 'right' : 'left';
                    const xPos = side === 'right' ? (isMobile ? '62%' : '80%') : (isMobile ? '-62%' : '-80%');
                    const rotation = side === 'right' ? (isMobile ? -34 : -35) : (isMobile ? 34 : 35);
                    additionalTransform = `translateX(${xPos}) scale(${isMobile ? '.38' : '.6'}) rotateY(${rotation}deg)`;
                    opacity = isMobile ? '.46' : '.4';
                    zIndex = '3';
                } else {
                    item.classList.add('is-hidden');
                }
                item.style.transform = `${baseTransform} ${additionalTransform}`;
                item.style.opacity = opacity;
                item.style.zIndex = zIndex;
                item.style.filter = filter;
            }
        }

        function nextItem() {
            currentIndex = (currentIndex + 1) % totalItems;
            updateCarousel();
        }

        function prevItem() {
            currentIndex = (currentIndex - 1 + totalItems) % totalItems;
            updateCarousel();
        }

        function goToItem(index) {
            currentIndex = index;
            updateCarousel();
        }

        function startAutoSlide() {
            autoSlideInterval = setInterval(nextItem, 5000);
        }

        function resetAutoSlide() {
            clearInterval(autoSlideInterval);
            startAutoSlide();
        }

        nextButton.addEventListener('click', () => {
            nextItem();
            resetAutoSlide();
        });

        prevButton.addEventListener('click', () => {
            prevItem();
            resetAutoSlide();
        });

        let touchStartX = 0;
        let touchEndX = 0;

        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            clearInterval(autoSlideInterval);
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
            startAutoSlide();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                nextItem();
            } else if (touchEndX > touchStartX + swipeThreshold) {
                prevItem();
            }
        }

        let resizeFrame;
        window.addEventListener('resize', () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(updateCarousel);
        });

        initializeCarousel();
    }
}

/**
 * =================================================================
 * HEADER SCROLL EFFECT
 * =================================================================
 */
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        header.classList.toggle('is-scrolled', window.scrollY > 50);
    });
}

/**
 * =================================================================
 * TIMELINE SCROLL PROGRESS
 * =================================================================
 */
function initTimelineScroll() {
    const timelineItems = document.querySelectorAll('.timeline__item');
    const timelineLine = document.querySelector('.timeline');
    const timelineLineProgress = document.querySelector('.timeline__line-progress');

    if (timelineItems.length > 0 && timelineLine && timelineLineProgress) {
        const handleScroll = () => {
            const timelineRect = timelineLine.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            const startPoint = windowHeight * 0.8;
            const endPoint = timelineRect.height - windowHeight * 0.2;

            let progress = (startPoint - timelineRect.top) / endPoint;
            let clampedProgress = Math.min(1, Math.max(0, progress));

            if (timelineRect.bottom < 0 || timelineRect.top > windowHeight) {
                clampedProgress = timelineRect.bottom < 0 ? 1 : 0;
            }
            
            timelineLineProgress.style.height = `${clampedProgress * 100}%`;
        };
        window.addEventListener('scroll', handleScroll);
    }
}

/**
 * =================================================================
 * "VIEW ALL TEMPLATES" BUTTON
 * =================================================================
 */
function initViewAllTemplatesButton() {
    const viewAllBtn = document.getElementById('view-all-templates-btn');
    const templatesGrid = document.querySelector('.explore-templates__grid');
    const templatesFooter = document.querySelector('.explore-templates__footer');

    if (viewAllBtn && templatesGrid && templatesFooter) {
        viewAllBtn.addEventListener('click', () => {
            templatesGrid.classList.add('show-all-templates');
            templatesFooter.style.display = 'none';
        });
    }
}

/**
 * =================================================================
 * FAQ ACCORDION
 * =================================================================
 */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    if (faqItems.length > 0) {
        faqItems.forEach(item => {
            const header = item.querySelector('.faq-item__header');
            header.addEventListener('click', () => {
                const currentlyOpen = document.querySelector('.faq-item.is-open');
                if (currentlyOpen && currentlyOpen !== item) {
                    currentlyOpen.classList.remove('is-open');
                    currentlyOpen.querySelector('.faq-item__header').setAttribute('aria-expanded', 'false');
                }

                item.classList.toggle('is-open');
                const isNowOpen = item.classList.contains('is-open');
                header.setAttribute('aria-expanded', isNowOpen);
            });
        });
    }
}

/**
 * =================================================================
 * GENERIC SCROLL-IN ANIMATIONS
 * =================================================================
 */
function initScrollAnimations() {
    const setupObserver = (selector, options, addStagger = false) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    if (addStagger) {
                        entry.target.style.transitionDelay = `${index * 100}ms`;
                    }
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, options);

        elements.forEach(el => observer.observe(el));
    };

    const defaultObserverOptions = { rootMargin: '0px 0px -100px 0px' };

    // Staggered animations
    setupObserver('.feature-card, .stat-card, .faq-item', defaultObserverOptions, true);
    
    // Non-staggered animations
    setupObserver('.cta', defaultObserverOptions, false);
    setupObserver('.quotation-document-showcase', defaultObserverOptions, false);
    setupObserver('.timeline__item', { threshold: 0.5 }, false);
}

/**
 * =================================================================
 * NAVIGATION SCROLLSPY (Active link highlighting)
 * =================================================================
 */
function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link--desktop');

    if (sections.length === 0 || navLinks.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                
                navLinks.forEach(link => {
                    link.classList.remove('is-active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('is-active');
                    }
                });
            }
        });
    }, {
        rootMargin: '-40% 0px -60% 0px'
    });

    sections.forEach(section => observer.observe(section));
}

/**
 * =================================================================
 * LOGIN PAGE SCRIPTS
 * =================================================================
 */
function initLoginPage() {
    // Floating Labels
    const inputGroups = document.querySelectorAll('.input-group');
    inputGroups.forEach(group => {
        const input = group.querySelector('.input-group__input');
        if (input) {
            // Check on load if input has value (e.g., browser autofill)
            if (input.value) {
                input.classList.add('has-content');
            }
            input.addEventListener('focus', () => group.classList.add('is-focused'));
            input.addEventListener('blur', () => {
                group.classList.remove('is-focused');
                if (input.value) {
                    input.classList.add('has-content');
                } else {
                    input.classList.remove('has-content');
                }
            });
        }
    });

    // Toggle Password Visibility
    const togglePasswordBtn = document.querySelector('.input-group__toggle-password');
    const passwordInput = document.getElementById('password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePasswordBtn.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
            // Optionally change icon here if you have two different SVG icons
        });
    }
}