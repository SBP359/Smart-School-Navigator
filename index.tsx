import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';






// ENTER YOUR SUPABASE DETAILS HERE
// --- SUPABASE SETUP ---
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);









// --- TYPE DEFINITIONS ---
interface SchoolInfo {
  id: number;
  name: string;
  about: string;
  slideshow: { img: string; caption: string }[];
}
interface Location { id: number; name: string; slug: string; is_classroom: boolean; }
interface Staff { id: number; name: string; title: string; department: string; room: string; }
interface Facility { id: number; name: string; description: string; }
interface RouteStep { text: string; map: string; }
interface Route { id: number; start_location: string; end_location: string; steps: RouteStep[]; }

type Page = 'landing' | 'about' | 'staff' | 'facilities' | 'navigate' | 'route' | 'select-start';
type AdminTab = 'school_info' | 'locations' | 'staff' | 'facilities' | 'routes';

// --- UTILITY FUNCTIONS ---
const RLS_POLICY_ERROR_MESSAGE = (tableName: string, operation: 'UPDATE' | 'INSERT' | 'DELETE') => 
    `Operation failed. This is likely due to a missing or incorrect Row Level Security (RLS) policy on the '${tableName}' table for the '${operation}' action. Please check your policies in the Supabase dashboard.`;

const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

// --- MAIN APP COMPONENT ---
const App = () => {
  const [page, setPage] = useState<Page>('landing');
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [startLocation, setStartLocation] = useState<Location | null>(null);

  // Data state
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  // App state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: infoData, error: infoError } = await supabaseClient.from('school_info').select('id, name, about, slideshow').limit(1).single();
      if (infoError) throw new Error(`School Info: ${infoError.message}`);
      setSchoolInfo(infoData);
      if (infoData?.name) {
          document.title = infoData.name;
      }

      const { data: locData, error: locError } = await supabaseClient.from('locations').select('id, name, slug, is_classroom').order('name');
      if (locError) throw new Error(`Locations: ${locError.message}`);
      const locs = locData.map((l: any) => ({ ...l, is_classroom: l.is_classroom ?? false }));
      setLocations(locs);

      // Handle deep linking for navigation from URL (e.g., QR code scan)
      const path = window.location.pathname.split('/');
      if (path[1] === 'navigate' && path[2]) {
        const slug = path[2];
        const foundLocation = locs.find((loc: Location) => loc.slug === slug);
        if (foundLocation) {
            setStartLocation(foundLocation);
            setPage('navigate');
        }
      }

      const { data: staffData, error: staffError } = await supabaseClient.from('staff').select('id, name, title, department, room').order('name');
      if (staffError) throw new Error(`Staff: ${staffError.message}`);
      setStaff(staffData);
      
      const { data: facData, error: facError } = await supabaseClient.from('facilities').select('id, name, description').order('name');
      if (facError) throw new Error(`Facilities: ${facError.message}`);
      setFacilities(facData);

      const { data: routesData, error: routesError } = await supabaseClient.from('routes').select('id, start_location, end_location, steps');
      if (routesError) throw new Error(`Routes: ${routesError.message}`);
      setRoutes(routesData);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("We couldn't load the school's information. Please check your internet connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Admin Page Routing ---
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin.html') {
    const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('isAdminAuthenticated') === 'true');

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };
    const handleLogout = () => {
        sessionStorage.removeItem('isAdminAuthenticated');
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;
    }
    if (isLoading) return <SkeletonLoader isAdmin />;
    if (error) return <ErrorScreen message={error} />;
    return (
      <AdminDashboard
        schoolName={schoolInfo?.name}
        data={{ schoolInfo, locations, staff, facilities, routes }}
        refreshData={fetchData}
        onLogout={handleLogout}
      />
    );
  }

  // --- Public Site Logic ---
  const navigateToRoute = (route: Route) => {
    setCurrentRoute(route);
    setPage('route');
  };
  
  const handleStartLocationSelect = (location: Location) => {
    setStartLocation(location);
    setPage('navigate');
  };

  const handleNavigateClick = () => {
    setStartLocation(null);
    setCurrentRoute(null);
    setPage('select-start');
  };
  
  const handleBackToNavigate = () => {
    setPage(startLocation ? 'navigate' : 'select-start');
  };

  const renderPage = () => {
    switch (page) {
      case 'about': return <AboutPage info={schoolInfo!} />;
      case 'staff': return <StaffPage staff={staff} animate={true} />;
      case 'facilities': return <FacilitiesPage facilities={facilities} animate={true} />;
      case 'select-start': return <SelectStartLocationPage locations={locations} routes={routes} onSelect={handleStartLocationSelect} />;
      case 'navigate': return <NavigatePage startLocation={startLocation!} locations={locations} routes={routes} onNavigate={navigateToRoute} onBack={handleNavigateClick} />;
      case 'route': return <RouteDisplayPage route={currentRoute!} onBack={handleBackToNavigate} />;
      case 'landing':
      default:
        return <LandingPage info={schoolInfo} setPage={setPage} onNavigateClick={handleNavigateClick} />;
    }
  };

  if (isLoading) return <SkeletonLoader />;
  if (error) return <ErrorScreen message={error} />;

  return (
    <div className="app-container">
      <Header schoolName={schoolInfo?.name || "School Navigator"} setPage={setPage} onNavigateClick={handleNavigateClick} currentPage={page} />
      <main className={page === 'route' ? 'full-bleed' : ''}><div className="page-content-wrapper">{renderPage()}</div></main>
    </div>
  );
};

// --- SCREENS & PAGES ---
const SkeletonLoader = ({ isAdmin = false }: { isAdmin?: boolean }) => {
    if (isAdmin) {
        return (
            <div className="admin-dashboard skeleton">
                <header className="admin-dashboard-header"></header>
                <div className="admin-dashboard-layout">
                    <aside className="admin-sidebar"></aside>
                    <main className="admin-main-content">
                        <div className="skeleton skeleton-card" style={{ height: '200px' }}></div>
                        <div className="skeleton skeleton-card" style={{ height: '300px' }}></div>
                    </main>
                </div>
            </div>
        );
    }
    return (
        <>
            <header className="app-header skeleton"></header>
            <main>
                <div className="skeleton skeleton-hero"></div>
                <div className="card-container">
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                    <div className="skeleton skeleton-card"></div>
                </div>
            </main>
        </>
    );
};
const ErrorScreen = ({ message }: { message: string }) => <div className="full-page-feedback error"><p><strong>Error</strong></p><p>{message}</p></div>;

const Header = ({ schoolName, setPage, onNavigateClick, currentPage }: { schoolName: string, setPage: (page: Page) => void; onNavigateClick: () => void; currentPage: Page }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNav = (page: Page) => {
        setPage(page);
        setIsMenuOpen(false);
    };

    const handleMobileNavigateClick = () => {
        onNavigateClick();
        setIsMenuOpen(false);
    };

    return (
        <header className="app-header">
            <div className="logo" onClick={() => handleNav('landing')}>
                <img src="logos.png" alt={schoolName + " Logo"} className="logo-image" />
            </div>

            <nav className="desktop-nav">
                <button onClick={() => handleNav('landing')} className={currentPage === 'landing' ? 'active' : ''}>Home</button>
                <button onClick={() => handleNav('about')} className={currentPage === 'about' ? 'active' : ''}>About</button>
                <button onClick={() => handleNav('staff')} className={currentPage === 'staff' ? 'active' : ''}>Staff</button>
                <button onClick={() => handleNav('facilities')} className={currentPage === 'facilities' ? 'active' : ''}>Facilities</button>
            </nav>

            <div className="header-actions">
                <button className="primary hide-on-mobile" onClick={onNavigateClick}>Navigate</button>
                <div className="admin-access">
                    <a href="/admin.html" aria-label="Open Admin Panel" title="Admin Panel">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    </a>
                </div>
                 <button className="mobile-menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu" aria-expanded={isMenuOpen}>
                    <div className={`hamburger ${isMenuOpen ? 'open' : ''}`}>
                        <span></span><span></span><span></span>
                    </div>
                </button>
            </div>

            <div className={`mobile-nav-backdrop ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
            <nav className={`mobile-nav ${isMenuOpen ? 'open' : ''}`}>
                 <button onClick={handleMobileNavigateClick} className={(currentPage === 'navigate' || currentPage === 'select-start' || currentPage === 'route') ? 'active' : ''}>Navigate</button>
                 <button onClick={() => handleNav('landing')} className={currentPage === 'landing' ? 'active' : ''}>Home</button>
                <button onClick={() => handleNav('about')} className={currentPage === 'about' ? 'active' : ''}>About</button>
                <button onClick={() => handleNav('staff')} className={currentPage === 'staff' ? 'active' : ''}>Staff</button>
                <button onClick={() => handleNav('facilities')} className={currentPage === 'facilities' ? 'active' : ''}>Facilities</button>
            </nav>
        </header>
    );
};

const LandingPage = ({ info, setPage, onNavigateClick }: { info: SchoolInfo | null; setPage: (page: Page) => void; onNavigateClick: () => void; }) => (
  <div className="landing-page">
    <div className="hero">
      <div className="hero-content">
        <h3>Welcome to {info?.name || 'Our School'}</h3>
        {/* FIX: Changed non-standard p1 tag to p tag. */}
        <p>{info?.about || 'Navigate our campus with ease.'}</p>
        <button className="cta-button" onClick={onNavigateClick}>Start Navigation</button>
      </div>
    </div>
    <div className="card-container">
      <div className="card" onClick={() => setPage('about')}>
        <div className="card-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <h3>About Us</h3><p>Learn our story</p>
      </div>
      <div className="card" onClick={() => setPage('staff')}>
        <div className="card-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <h3>Staff Directory</h3><p>Find faculty members</p>
      </div>
      <div className="card" onClick={() => setPage('facilities')}>
        <div className="card-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
        <h3>Our Facilities</h3><p>Explore the campus</p>
      </div>
    </div>
    {info?.slideshow && info.slideshow.length > 0 && <Slideshow slides={info.slideshow} />}
  </div>
);

const AboutPage = ({ info }: { info: SchoolInfo }) => (
  <div className="content-page">
    <h2>About {info.name}</h2>
    <p>{info.about}</p>
    {info.slideshow && info.slideshow.length > 0 && <Slideshow slides={info.slideshow} />}
  </div>
);

const StaffPage = ({ staff, animate = false }: { staff: Staff[], animate?: boolean }) => (
  <div className="content-page">
    <h2>Staff & Council</h2>
    <div className="list-container">
      {staff.map((s, i) => (
        <div key={i} className="list-item" style={animate ? { animationDelay: `${i * 50}ms` } : {}}>
          <h3>{s.name}</h3>
          <p><strong>{s.title}</strong> - {s.department}</p>
          <p>Office: {s.room}</p>
        </div>
      ))}
    </div>
  </div>
);

const FacilitiesPage = ({ facilities, animate = false }: { facilities: Facility[], animate?: boolean }) => (
  <div className="content-page">
    <h2>Facilities</h2>
    <div className="list-container">
      {facilities.map((f, i) => (
        <div key={i} className="list-item" style={animate ? { animationDelay: `${i * 50}ms` } : {}}>
          <h3>{f.name}</h3>
          <p>{f.description}</p>
        </div>
      ))}
    </div>
  </div>
);

const EmptyState = ({ icon, title, message }: { icon: React.ReactNode; title: string; message: string; }) => (
    <div className="empty-state">
        <div className="empty-state-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{message}</p>
    </div>
);

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; }) => (
    <div className="search-input-container">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" value={value} onChange={onChange} placeholder={placeholder} />
    </div>
);

const SearchableLocationList = ({ locations, onSelect, emptyState }: { locations: Location[]; onSelect: (location: Location) => void; emptyState: React.ReactNode; }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isClassroomsOpen, setIsClassroomsOpen] = useState(false);

    const { classrooms, otherLocations } = React.useMemo(() => {
        const classrooms: Location[] = [];
        const otherLocations: Location[] = [];
        locations.forEach(loc => {
            if (loc.is_classroom) {
                classrooms.push(loc);
            } else {
                otherLocations.push(loc);
            }
        });
        return { classrooms, otherLocations };
    }, [locations]);

    const filteredClassrooms = classrooms.filter(loc => loc.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredOtherLocations = otherLocations.filter(loc => loc.name.toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        if (searchTerm && filteredClassrooms.length > 0 && filteredOtherLocations.length === 0) {
            setIsClassroomsOpen(true);
        }
    }, [searchTerm, filteredClassrooms.length, filteredOtherLocations.length]);

    const renderLocationItem = (loc: Location, i: number) => (
        <li key={loc.id} onClick={() => onSelect(loc)} className="search-result-item" style={{ animationDelay: `${i * 30}ms` }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>{loc.name}</span>
        </li>
    );

    return (
        <div className="search-container">
            <SearchInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search for a location..." />
            <div className="search-results">
                {filteredOtherLocations.length > 0 || filteredClassrooms.length > 0 ? (
                    <ul className="search-results-list">
                        {filteredOtherLocations.map(renderLocationItem)}
                        {filteredClassrooms.length > 0 && (
                             <li className="search-result-group">
                                <button type="button" onClick={() => setIsClassroomsOpen(!isClassroomsOpen)} className={`group-toggle-button ${isClassroomsOpen ? 'open' : ''}`} aria-expanded={isClassroomsOpen}>
                                    <div className="group-toggle-label">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                        <span>Classrooms</span>
                                    </div>
                                    <div className="group-toggle-indicator">
                                        <span className="group-count">{filteredClassrooms.length}</span>
                                        <svg className="group-arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    </div>
                                </button>
                                {isClassroomsOpen && (
                                    <ul className="search-results-sublist">
                                        {filteredClassrooms.map(renderLocationItem)}
                                    </ul>
                                )}
                            </li>
                        )}
                    </ul>
                ) : ( searchTerm ? (
                    <EmptyState 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>}
                        title="No results found"
                        message={`We couldn't find any locations matching "${searchTerm}".`}
                    />
                ) : (
                    emptyState
                ))}
            </div>
        </div>
    );
};


const SelectStartLocationPage = ({ locations, routes, onSelect }: { locations: Location[]; routes: Route[]; onSelect: (location: Location) => void }) => {
    const startLocationNames = new Set(routes.map(r => r.start_location));
    const availableStartLocations = locations.filter(l => startLocationNames.has(l.name));

    return (
        <div className="navigate-page">
            <h2>Where are you starting from?</h2>
            <p>Select your current location to see available destinations.</p>
            <SearchableLocationList 
                locations={availableStartLocations}
                onSelect={onSelect}
                emptyState={
                    <EmptyState 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>}
                        title="No routes configured"
                        message="It looks like no navigation routes have been set up yet. An admin can add them from the admin panel."
                    />
                }
            />
        </div>
    );
};

const NavigatePage = ({ startLocation, locations, routes, onNavigate, onBack }: { startLocation: Location; locations: Location[]; routes: Route[]; onNavigate: (route: Route) => void; onBack: () => void; }) => {
    const handleNavigation = (destinationName: string) => {
        const foundRoute = routes.find(r => r.start_location === startLocation.name && r.end_location === destinationName);
        if (foundRoute) {
            onNavigate(foundRoute);
        } else {
            alert('Route not found for this destination.');
        }
    };

    const availableDestinationNames = new Set(
        routes.filter(route => route.start_location === startLocation.name).map(route => route.end_location)
    );
    
    const destinationsWithRoutes = locations.filter(location => availableDestinationNames.has(location.name));

    return (
        <div className="navigate-page">
            <div className="navigate-header">
                <button onClick={onBack} className="text-button">&larr; Change Start Location</button>
                <h2>Where to from <strong>{startLocation.name}</strong>?</h2>
            </div>
            <SearchableLocationList 
                locations={destinationsWithRoutes}
                onSelect={(loc) => handleNavigation(loc.name)}
                emptyState={
                     <EmptyState 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>}
                        title="No destinations found"
                        message="There are no configured routes from this starting location."
                    />
                }
            />
        </div>
    );
};

const RouteDisplayPage = ({ route, onBack }: { route: Route; onBack: () => void }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
    };
  }, [stepIndex, route]);

  const handleSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech is not supported in your browser.');
        return;
    }
    
    if (isSpeaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
    } else {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error);
            setIsSpeaking(false);
        };
        speechSynthesis.speak(utterance);
        setIsSpeaking(true);
    }
  };
  
  const changeStep = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= route.steps.length) return;
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
    }
    setStepIndex(newIndex);
  };

  const currentStep = route.steps[stepIndex];

  return (
    <div className="route-display-page">
      <div className="route-header">
        <button onClick={onBack}>&larr; Back to Destinations</button>
        <h2>Route to {route.end_location}</h2>
      </div>
      
      <div className="route-content">
        <div className="step-content">
            <div className="route-map">
                {currentStep.map ? <img src={currentStep.map} alt={`Map for step ${stepIndex + 1}`} /> : <div className="no-map">No map available for this step.</div> }
            </div>
            <div className="route-instructions">
              <p>{currentStep.text}</p>
              <button onClick={() => handleSpeech(currentStep.text)} className="speak-button" aria-label={isSpeaking ? "Stop reading instruction aloud" : "Read instruction aloud"}>
                {isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                )}
              </button>
            </div>
        </div>
      </div>

      <div className="route-navigation">
        <button onClick={() => changeStep(stepIndex - 1)} disabled={stepIndex === 0}>Previous</button>
        <span className="step-counter">Step {stepIndex + 1} of {route.steps.length}</span>
        <button onClick={() => changeStep(stepIndex + 1)} disabled={stepIndex === route.steps.length - 1}>Next</button>
      </div>
    </div>
  );
};

const Slideshow = ({ slides }: { slides: { img: string, caption: string }[] }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setTimeout(() => {
      setIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, slides.length]);
  
  if (!slides || slides.length === 0) return null;

  return (
    <div className="slideshow-container">
      {slides.map((slide, i) => (
        <div key={i} className={`slide ${i === index ? 'active' : ''}`}>
          <img src={slide.img} alt={slide.caption} />
          <div className="caption">{slide.caption}</div>
        </div>
      ))}
    </div>
  );
};


// --- ADMIN PAGE & COMPONENTS ---

const AdminLoginPage = ({ onLoginSuccess }: { onLoginSuccess: () => void; }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'admin123') { // Demo password
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            setError('');
            onLoginSuccess();
        } else {
            setError('Incorrect password.');
        }
    };

    return (
        <div className="admin-login-page">
            <div className="login-card">
                <img src="logos.png" alt="Logo" className="login-logo" />
                <form onSubmit={handleLogin}>
                    <h2>Admin Panel</h2>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      aria-label="Admin Password"
                    />
                    <button type="submit" className="primary">Login</button>
                    {error && <p className="error-text">{error}</p>}
                </form>
                <a href="/" className="back-to-site-link">← Back to Site</a>
            </div>
        </div>
    );
};

const AdminSidebar = ({ activeTab, onNavigate, isSidebarOpen }: { activeTab: AdminTab; onNavigate: (tab: AdminTab) => void; isSidebarOpen: boolean; }) => {
  const navItems = [
    { id: 'school_info', label: 'School Info', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { id: 'locations', label: 'Locations', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> },
    { id: 'routes', label: 'Routes', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6.998a4 4 0 1 0-8 0 4 4 0 0 0 8 0z"/><path d="M12 12.998v-2"/><path d="M18 20.998a4 4 0 1 0-8 0 4 4 0 0 0 8 0z"/><path d="M12 10.998v-2"/><path d="M6.15 9.428a4.002 4.002 0 0 0-4.145 2.57 4.002 4.002 0 0 0 4.146 5.432"/><path d="M10 12.998h-2"/><path d="M6.15 14.568a4.002 4.002 0 0 0-4.145-2.57 4.002 4.002 0 0 0 4.146-5.432"/><path d="M10 10.998H8"/></svg> },
    { id: 'staff', label: 'Staff', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'facilities', label: 'Facilities', icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
  ];

  return (
    <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <nav className="admin-sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as AdminTab)}
            className={`admin-nav-button ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};


const AdminDashboard = ({ schoolName, data, refreshData, onLogout }: { 
  schoolName?: string;
  data: { schoolInfo: SchoolInfo | null, locations: Location[], staff: Staff[], facilities: Facility[], routes: Route[] }, 
  refreshData: () => Promise<void>,
  onLogout: () => void 
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('school_info');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSidebarNavigate = (tab: AdminTab) => {
      setActiveTab(tab);
      setIsSidebarOpen(false);
  };

  const renderAdminTab = () => {
    switch (activeTab) {
        case 'school_info': return data.schoolInfo ? <ManageSchoolInfo info={data.schoolInfo} refreshData={refreshData} /> : <p>School info not loaded.</p>;
        case 'locations': return <ManageLocations locations={data.locations} refreshData={refreshData} />;
        case 'staff': return <ManageStaff staff={data.staff} refreshData={refreshData} />;
        case 'facilities': return <ManageFacilities facilities={data.facilities} refreshData={refreshData} />;
        case 'routes': return <ManageRoutes routes={data.routes} locations={data.locations} refreshData={refreshData} />;
        default: return null;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
        case 'school_info': return 'School Information';
        case 'locations': return 'Manage Locations';
        case 'staff': return 'Manage Staff';
        case 'facilities': return 'Manage Facilities';
        case 'routes': return 'Manage Routes';
        default: return 'Dashboard';
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-dashboard-header">
          <div className="admin-header-brand">
            <button className="admin-mobile-menu-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle admin menu" aria-expanded={isSidebarOpen}>
                <div className={`hamburger ${isSidebarOpen ? 'open' : ''}`}>
                    <span></span><span></span><span></span>
                </div>
            </button>
            <img src="logos.png" alt="Logo" className="admin-logo"/>
            <span>{schoolName} Admin</span>
          </div>
          <div className="admin-dashboard-actions">
              <a href="/" className="secondary button-link">View Site</a>
              <button onClick={onLogout} className="logout-button">Logout</button>
          </div>
      </header>
      <div className="admin-dashboard-layout">
        <div className={`admin-sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
        <AdminSidebar activeTab={activeTab} onNavigate={handleSidebarNavigate} isSidebarOpen={isSidebarOpen} />
        <main className="admin-main-content">
            <h2 className="admin-page-title">{getTabTitle()}</h2>
            <div className="admin-tab-content-wrapper">
                {renderAdminTab()}
            </div>
        </main>
      </div>
    </div>
  );
};

// --- IMAGE UPLOADER & CAMERA ---
const CameraCaptureModal = ({ onClose, onCapture }: { onClose: () => void; onCapture: (file: File) => void; }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startStream = async () => {
        try {
            setError(null);
            setCapturedImage(null);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
        } catch (err) {
            console.error("Camera access denied:", err);
            setError("Could not access camera. Please check your browser permissions.");
        }
    };

    useEffect(() => {
        startStream();
        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setCapturedImage(dataUrl);
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleUsePhoto = () => {
        if (capturedImage) {
            fetch(capturedImage)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    onClose();
                });
        }
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal-content camera-modal-content" style={{ maxWidth: '600px' }}>
                <button onClick={onClose} className="close-button" aria-label="Close camera">&times;</button>
                <h3>{capturedImage ? 'Preview' : 'Take Photo'}</h3>

                {error && <div className="error-text" style={{margin: '1rem 0'}}>{error}</div>}
                
                <div style={{ display: capturedImage ? 'none' : 'block' }}>
                    <video ref={videoRef} autoPlay playsInline muted></video>
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                </div>
                
                {capturedImage && <img src={capturedImage} alt="Captured preview" className="capture-preview" />}

                <div className="form-actions" style={{ marginTop: '1rem' }}>
                    {!capturedImage && !error && (
                        <button onClick={handleCapture} className="primary" style={{ width: '100%' }}>Snap Photo</button>
                    )}
                    {capturedImage && (
                        <>
                            <button onClick={startStream} className="secondary">Retake</button>
                            <button onClick={handleUsePhoto} className="primary">Use Photo</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const UploadChoiceModal = ({ onClose, onFromFile, onFromCamera }: { onClose: () => void; onFromFile: () => void; onFromCamera: () => void; }) => {
    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal-content upload-choice-modal" style={{ maxWidth: '350px' }}>
                <button onClick={onClose} className="close-button" aria-label="Close">&times;</button>
                <h3>Add a Map Image</h3>
                <p style={{ color: 'var(--text-color-secondary)', textAlign: 'center', marginBottom: '1rem' }}>Choose an option to add an image for this navigation step.</p>
                <div className="form-actions">
                    <button onClick={onFromCamera} className="primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '0.5rem'}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        Take a Photo
                    </button>
                    <button onClick={onFromFile} className="secondary">
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '0.5rem'}}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Upload from Library
                    </button>
                </div>
            </div>
        </div>
    );
};

const ImageUploader = ({ initialImageUrl, onUpload, bucketName, bucketPath }: { 
    initialImageUrl: string | null; 
    onUpload: (url: string) => void; 
    bucketName: string;
    bucketPath: string; 
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        setPreviewUrl(initialImageUrl);
    }, [initialImageUrl]);

    const handleUpload = async (file: File | undefined | null) => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        const localPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(localPreviewUrl);

        try {
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${bucketPath}/${Date.now()}-${sanitizedFileName}`;
            
            const { error: uploadError } = await supabaseClient.storage.from(bucketName).upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(fileName);
            if (!data.publicUrl) throw new Error("Could not get public URL.");
            
            URL.revokeObjectURL(localPreviewUrl); // Clean up local URL
            setPreviewUrl(data.publicUrl);
            onUpload(data.publicUrl);
        } catch (err: any) {
            console.error("Image upload failed:", err);
            setError(err.message || 'An unknown error occurred during upload.');
            URL.revokeObjectURL(localPreviewUrl); // Clean up local URL
            setPreviewUrl(initialImageUrl);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleUpload(event.target.files?.[0]);
    };
    
    const handleTriggerFileUpload = () => {
        setIsChoiceModalOpen(false);
        fileInputRef.current?.click();
    };
    
    const handleTriggerCamera = () => {
        setIsChoiceModalOpen(false);
        setIsCameraOpen(true);
    };

    const handleCameraCapture = (file: File) => {
        setIsCameraOpen(false);
        handleUpload(file);
    };

    return (
        <div className="image-uploader-component">
            <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                ref={fileInputRef}
                style={{ display: 'none' }}
                disabled={isUploading}
            />
            <div className="image-preview" onClick={() => !isUploading && setIsChoiceModalOpen(true)} title="Click to upload an image">
                {isUploading ? (
                    <div className="spinner"></div>
                ) : previewUrl ? (
                    <img src={previewUrl} alt="Preview" />
                ) : (
                    <div className="placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Upload Map</span>
                    </div>
                )}
            </div>
            {error && <p className="error-text small">{error}</p>}
            
            {isChoiceModalOpen && (
                <UploadChoiceModal 
                    onClose={() => setIsChoiceModalOpen(false)}
                    onFromFile={handleTriggerFileUpload}
                    onFromCamera={handleTriggerCamera}
                />
            )}
            
            {isCameraOpen && (
                <CameraCaptureModal
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={handleCameraCapture}
                />
            )}
        </div>
    );
};

// --- ADMIN MANAGEMENT COMPONENTS ---

const ManageSchoolInfo = ({ info, refreshData }: { info: SchoolInfo; refreshData: () => Promise<void> }) => {
    const [currentInfo, setCurrentInfo] = useState(info);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setCurrentInfo(info);
    }, [info]);

    const handleFieldChange = (field: keyof SchoolInfo, value: any) => {
        setCurrentInfo(prev => ({ ...prev!, [field]: value }));
    };

    const handleSlideChange = (index: number, field: 'img' | 'caption', value: string) => {
        const newSlideshow = [...currentInfo.slideshow];
        newSlideshow[index] = { ...newSlideshow[index], [field]: value };
        handleFieldChange('slideshow', newSlideshow);
    };

    const addSlide = () => {
        handleFieldChange('slideshow', [...currentInfo.slideshow, { img: '', caption: '' }]);
    };

    const removeSlide = (index: number) => {
        handleFieldChange('slideshow', currentInfo.slideshow.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        const { id, ...updateData } = currentInfo;
        const { error: updateError } = await supabaseClient
            .from('school_info')
            .update(updateData)
            .eq('id', id);

        if (updateError) {
            setError(RLS_POLICY_ERROR_MESSAGE('school_info', 'UPDATE'));
            console.error(updateError);
        } else {
            alert('School info updated!');
            await refreshData();
        }
        setIsSaving(false);
    };

    return (
        <div className="manage-school-info">
            <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="admin-form">
                <label>School Name</label>
                <input type="text" value={currentInfo.name} onChange={e => handleFieldChange('name', e.target.value)} />

                <label>About Section</label>
                <textarea value={currentInfo.about} onChange={e => handleFieldChange('about', e.target.value)} rows={5}></textarea>

                <hr/>
                <h4>Slideshow Images</h4>
                <div className="slideshow-editor-list">
                {currentInfo.slideshow.map((slide, index) => (
                    <div key={index} className="slide-editor">
                        <input type="text" placeholder="Image URL" value={slide.img} onChange={e => handleSlideChange(index, 'img', e.target.value)} />
                        <input type="text" placeholder="Caption" value={slide.caption} onChange={e => handleSlideChange(index, 'caption', e.target.value)} />
                        <button type="button" onClick={() => removeSlide(index)} className="danger small">&times;</button>
                    </div>
                ))}
                </div>
                <button type="button" onClick={addSlide} className="secondary">Add Slide</button>
                <hr/>

                <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                {error && <p className="error-text">{error}</p>}
            </form>
        </div>
    );
};

const ManageGenericList = <T extends { id: number, [key: string]: any }>({
    items,
    refreshData,
    tableName,
    columns,
    itemName,
}: {
    items: T[],
    refreshData: () => Promise<void>,
    tableName: string,
    columns: { key: keyof T, label: string, type: 'text' | 'textarea' | 'checkbox' }[],
    itemName: string
}) => {
    const getInitialNewItem = React.useCallback(() => {
        const initialItem: Partial<T> = {};
        columns.forEach(col => {
            if (col.type === 'checkbox') {
                initialItem[col.key] = false as any;
            } else {
                initialItem[col.key] = '' as any;
            }
        });
        return initialItem;
    }, [columns]);

    const [newItem, setNewItem] = useState<Partial<T>>(getInitialNewItem());
    const [editingItem, setEditingItem] = useState<T | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (itemToSave: Partial<T> & { id?: number }) => {
        for (const col of columns) {
             if (col.type !== 'checkbox' && !itemToSave[col.key]) {
                alert(`Please fill in the ${col.label}.`);
                return;
            }
        }

        setIsSaving(true);
        setError('');

        let operation: 'INSERT' | 'UPDATE' = 'INSERT';
        let query;

        if (editingItem && 'id' in itemToSave && itemToSave.id) {
            operation = 'UPDATE';
            const { id, ...updateData } = itemToSave;
            query = supabaseClient.from(tableName).update(updateData).eq('id', id);
        } else {
            if (tableName === 'locations' && 'name' in itemToSave && typeof itemToSave.name === 'string') {
                (itemToSave as any).slug = slugify(itemToSave.name);
            }
            query = supabaseClient.from(tableName).insert([itemToSave]).select();
        }

        const { error: saveError } = await query;

        if (saveError) {
            setError(RLS_POLICY_ERROR_MESSAGE(tableName, operation));
            console.error(saveError);
        } else {
            await refreshData();
            setNewItem(getInitialNewItem());
            setEditingItem(null);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(`Are you sure you want to delete this ${itemName}?`)) return;
        setIsSaving(true);
        setError('');
        const { error: deleteError } = await supabaseClient.from(tableName).delete().eq('id', id);
        if (deleteError) {
            setError(RLS_POLICY_ERROR_MESSAGE(tableName, 'DELETE'));
            console.error(deleteError);
        } else {
            await refreshData();
        }
        setIsSaving(false);
    };

    const renderForm = (item: Partial<T>, setItem: React.Dispatch<React.SetStateAction<any>>, isEditing: boolean) => (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(item); }} className="admin-form compact">
            <div className="form-fields">
            {columns.map(col => {
                const key = col.key as string;
                switch (col.type) {
                    case 'textarea':
                        return <textarea key={key} placeholder={col.label} value={item[key] || ''} onChange={e => setItem({ ...item, [key]: e.target.value })} required />;
                    case 'checkbox':
                        return (
                            <div key={key} className="form-field-checkbox">
                                <input id={`${key}-${item.id || 'new'}`} type="checkbox" checked={!!item[key]} onChange={e => setItem({ ...item, [key]: e.target.checked })} />
                                <label htmlFor={`${key}-${item.id || 'new'}`}>{col.label}</label>
                            </div>
                        );
                    case 'text':
                    default:
                        return <input key={key} type="text" placeholder={col.label} value={item[key] || ''} onChange={e => setItem({ ...item, [key]: e.target.value })} required />;
                }
            })}
            </div>
            <div className="form-actions">
                <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
                {isEditing && <button type="button" onClick={() => setEditingItem(null)} className="secondary">Cancel</button>}
            </div>
        </form>
    );

    return (
        <div className="manage-list">
            <h4>Add New {itemName}</h4>
            {renderForm(newItem, setNewItem, false)}

            <hr />

            <h4>Existing {itemName}s ({items.length})</h4>
            {error && <p className="error-text">{error}</p>}
            <ul className="admin-item-list">
                {items.map(item => (
                    <li key={item.id}>
                        {editingItem?.id === item.id ? (
                            renderForm(editingItem, setEditingItem, true)
                        ) : (
                            <div className="item-display">
                                <div className="item-text">
                                    <span>
                                        {columns.filter(c => c.type === 'text' || c.type === 'textarea').map(c => item[c.key]).join(' - ')}
                                    </span>
                                    {columns.filter(c => c.type === 'checkbox' && item[c.key]).map(c => {
                                        const tagName = c.label.replace('Is a ', '').replace('?', '');
                                        return <span key={c.key as string} className="item-tag">{tagName}</span>
                                    })}
                                </div>
                                <div className="item-actions">
                                    <button onClick={() => setEditingItem({ ...item })} className="small">Edit</button>
                                    <button onClick={() => handleDelete(item.id)} className="danger small">Delete</button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const ManageLocations = ({ locations, refreshData }: { locations: Location[], refreshData: () => Promise<void> }) => (
    <ManageGenericList
        items={locations}
        refreshData={refreshData}
        tableName="locations"
        itemName="Location"
        columns={[
            { key: 'name', label: 'Location Name', type: 'text' },
            { key: 'is_classroom', label: 'Is a Classroom?', type: 'checkbox' }
        ]}
    />
);

const ManageStaff = ({ staff, refreshData }: { staff: Staff[], refreshData: () => Promise<void> }) => (
    <ManageGenericList
        items={staff}
        refreshData={refreshData}
        tableName="staff"
        itemName="Staff Member"
        columns={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'department', label: 'Department', type: 'text' },
            { key: 'room', label: 'Office/Room', type: 'text' },
        ]}
    />
);

const ManageFacilities = ({ facilities, refreshData }: { facilities: Facility[], refreshData: () => Promise<void> }) => (
     <ManageGenericList
        items={facilities}
        refreshData={refreshData}
        tableName="facilities"
        itemName="Facility"
        columns={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'description', label: 'Description', type: 'textarea' },
        ]}
    />
);

const SelectDuplicateEndpointsModal = ({
    baseRoute,
    locations,
    onClose,
    onProceed,
    isSaving,
}: {
    baseRoute: Route;
    locations: Location[];
    onClose: () => void;
    onProceed: (start: string, end: string) => void;
    isSaving: boolean;
}) => {
    const locationNames = locations.map(l => l.name).sort();
    const [newStart, setNewStart] = useState(baseRoute.start_location);
    const [newEnd, setNewEnd] = useState(baseRoute.end_location);
    const [error, setError] = useState('');

    const handleSubmit = () => {
        setError('');
        if (newStart === newEnd) {
            setError('Start and end locations cannot be the same.');
            return;
        }
        onProceed(newStart, newEnd);
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal-content" style={{ maxWidth: '500px' }}>
                <button onClick={onClose} className="close-button" aria-label="Close modal" disabled={isSaving}>&times;</button>
                <h3>Duplicate Route</h3>
                <p>Select new start and end points for the copied route.</p>
                <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="admin-form">
                    <label>New Start Location</label>
                    <select value={newStart} onChange={e => setNewStart(e.target.value)} disabled={isSaving}>
                        {locationNames.map(name => <option key={`start-${name}`} value={name}>{name}</option>)}
                    </select>
                   
                    <label>New End Location</label>
                    <select value={newEnd} onChange={e => setNewEnd(e.target.value)} disabled={isSaving}>
                        {locationNames.map(name => <option key={`end-${name}`} value={name}>{name}</option>)}
                    </select>
                    
                    {error && <p className="error-text" style={{textAlign: 'left', marginTop: '1rem'}}>{error}</p>}
                    <hr />
                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="secondary" disabled={isSaving}>Cancel</button>
                        <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Proceed to Editor'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ManageRoutes = ({ routes, locations, refreshData }: { routes: Route[]; locations: Location[]; refreshData: () => Promise<void> }) => {
    const [editingRoute, setEditingRoute] = useState<Route | Partial<Route> | null>(null);
    const [routeToDuplicate, setRouteToDuplicate] = useState<Route | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const locationNames = locations.map(l => l.name).sort();

    const startNewRoute = () => {
        setEditingRoute({
            start_location: '',
            end_location: '',
            steps: [{ text: '', map: '' }]
        });
    };

    const handleProceedToDuplicateEditor = (finalStart: string, finalEnd: string) => {
        if (!routeToDuplicate) return;
        
        const copiedSteps = routeToDuplicate.steps.map(step => ({ ...step }));
    
        setEditingRoute({
            start_location: finalStart,
            end_location: finalEnd,
            steps: copiedSteps
        });
        setRouteToDuplicate(null);
    };

    const handleRouteFieldChange = (field: keyof Route, value: any) => {
        setEditingRoute(prev => ({ ...prev!, [field]: value }));
    };

    const handleStepChange = (index: number, field: keyof RouteStep, value: string) => {
        if (!editingRoute || !editingRoute.steps) return;
        const newSteps = [...editingRoute.steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        handleRouteFieldChange('steps', newSteps);
    };

    const addStep = () => {
        if (!editingRoute || !editingRoute.steps) return;
        handleRouteFieldChange('steps', [...editingRoute.steps, { text: '', map: '' }]);
    };

    const removeStep = (index: number) => {
        if (!editingRoute || !editingRoute.steps) return;
        handleRouteFieldChange('steps', editingRoute.steps.filter((_, i) => i !== index));
    };

    const handleSaveRoute = async () => {
        if (!editingRoute) return;
    
        const finalStartLocation = editingRoute.start_location || '';
        const finalEndLocation = editingRoute.end_location || '';
    
        if (!finalStartLocation || !finalEndLocation) {
            alert('Please select a start and end location.');
            return;
        }
        if (finalStartLocation === finalEndLocation) {
            alert('Start and end locations cannot be the same.');
            return;
        }
        if (!editingRoute.steps || editingRoute.steps.length === 0 || !editingRoute.steps.every(s => s.text && s.text.trim())) {
            alert('Please add at least one step with instructions.');
            return;
        }
    
        setIsSaving(true);
        setError('');
    
        try {
            const isNew = !('id' in editingRoute);
            const operation: 'INSERT' | 'UPDATE' = isNew ? 'INSERT' : 'UPDATE';
            let query;
    
            if (isNew) {
                const { id, ...insertData } = editingRoute;
                query = supabaseClient.from('routes').insert([insertData]);
            } else {
                const { id, ...updateData } = editingRoute as Route;
                query = supabaseClient.from('routes').update(updateData).eq('id', id);
            }
    
            const { error: saveError } = await query;
            if (saveError) {
                setError(RLS_POLICY_ERROR_MESSAGE('routes', operation));
                console.error(saveError);
            } else {
                setEditingRoute(null);
                await refreshData();
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during save.');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteRoute = async (routeId: number) => {
        if (!window.confirm('Are you sure you want to delete this route?')) return;
        setIsSaving(true);
        setError('');

        const { error: deleteError } = await supabaseClient.from('routes').delete().eq('id', routeId);
        if (deleteError) {
            setError(RLS_POLICY_ERROR_MESSAGE('routes', 'DELETE'));
            console.error(deleteError);
        } else {
            if (editingRoute && 'id' in editingRoute && editingRoute.id === routeId) {
                setEditingRoute(null);
            }
            await refreshData();
        }
        setIsSaving(false);
    };

    if (editingRoute) {
        return (
            <div className="manage-routes-editor">
                <h3>{('id' in editingRoute) ? 'Edit Route' : 'Create New Route'}</h3>
                 <form onSubmit={e => { e.preventDefault(); handleSaveRoute(); }} className="admin-form">
                    <div className="route-endpoints">
                        <div className="form-field-group">
                            <label>From:</label>
                            <select value={editingRoute.start_location || ''} onChange={e => handleRouteFieldChange('start_location', e.target.value)}>
                                <option value="" disabled>Select start location</option>
                                {locationNames.map(name => <option key={`start-${name}`} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="form-field-group">
                            <label>To:</label>
                             <select value={editingRoute.end_location || ''} onChange={e => handleRouteFieldChange('end_location', e.target.value)}>
                                <option value="" disabled>Select end location</option>
                                {locationNames.map(name => <option key={`end-${name}`} value={name}>{name}</option>)}
                            </select>
                        </div>
                    </div>

                    <h4>Steps</h4>
                    <div className="route-steps-editor">
                        {editingRoute.steps?.map((step, index) => (
                            <div key={index} className="step-editor">
                                <div className="step-number">Step {index + 1}</div>
                                <div className="step-inputs">
                                    <textarea placeholder="Instructions for this step..." value={step.text} onChange={e => handleStepChange(index, 'text', e.target.value)} rows={3} required />
                                    <ImageUploader
                                        initialImageUrl={step.map}
                                        onUpload={(url) => handleStepChange(index, 'map', url)}
                                        bucketName="route-maps"
                                        bucketPath={`${slugify(editingRoute.start_location || 'new')}-to-${slugify(editingRoute.end_location || 'new')}`}
                                    />
                                </div>
                                <button type="button" onClick={() => removeStep(index)} className="danger small remove-step-btn">&times;</button>
                            </div>
                        ))}
                    </div>
                     <button type="button" onClick={addStep} className="secondary">Add Step</button>
                    <hr />
                    <div className="form-actions">
                        <button type="submit" disabled={isSaving}>{isSaving ? 'Saving Route...' : 'Save Route'}</button>
                        <button type="button" onClick={() => setEditingRoute(null)} className="secondary">Cancel</button>
                    </div>
                     {error && <p className="error-text">{error}</p>}
                </form>
            </div>
        );
    }

    return (
        <div className="manage-routes-list">
             <div className="manage-list-header">
                <h4>Existing Routes ({routes.length})</h4>
                <button onClick={startNewRoute}>+ New Route</button>
            </div>
            {error && <p className="error-text">{error}</p>}
            <ol className="admin-item-list numbered">
                {routes.map(route => (
                    <li key={route.id}>
                        <div className="item-display">
                            <span className="item-text">
                                <strong>From:</strong> {route.start_location} <strong>To:</strong> {route.end_location} ({route.steps.length} steps)
                            </span>
                            <div className="item-actions">
                                <button onClick={() => setEditingRoute({ ...route })} className="small secondary">Edit</button>
                                <button onClick={() => setRouteToDuplicate(route)} className="small secondary">Duplicate</button>
                                <button onClick={() => handleDeleteRoute(route.id)} className="danger small">Delete</button>
                            </div>
                        </div>
                    </li>
                ))}
                {routes.length === 0 && <p>No routes created yet.</p>}
            </ol>
            {routeToDuplicate && (
                <SelectDuplicateEndpointsModal
                    baseRoute={routeToDuplicate}
                    locations={locations}
                    onClose={() => setRouteToDuplicate(null)}
                    onProceed={handleProceedToDuplicateEditor}
                    isSaving={isSaving}
                />
            )}
        </div>
    );
};


const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);