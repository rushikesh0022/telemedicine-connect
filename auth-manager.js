// auth-manager.js - User and session management
class AuthManager {
    constructor(logger) {
        this.users = new Map();
        this.activeSessions = new Map();
        this.logger = logger;
        
        // Session cleanup interval
        setInterval(() => this.cleanupSessions(), 3600000); // Every hour
    }
    
    // User registration
    async registerUser(email, password, name) {
        if (this.users.has(email)) {
            throw new Error('User already exists');
        }
        
        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = uuidv4();
        const now = new Date();
        
        const user = {
            id: userId,
            email,
            password: hashedPassword,
            name,
            createdAt: now,
            lastLogin: now,
            isActive: true,
            roles: ['user'],
            settings: {
                notifications: true,
                theme: 'light',
                language: 'en'
            },
            profile: {
                avatar: null,
                title: '',
                bio: ''
            }
        };
        
        this.users.set(email, user);
        this.logger.info(`New user registered: ${email}`);
        
        return {
            id: userId,
            email,
            name,
            settings: user.settings
        };
    }
    
    // User login
    async loginUser(email, password) {
        const user = this.users.get(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }
        
        // Update last login
        user.lastLogin = new Date();
        
        // Generate session token
        const token = this.generateSessionToken(user);
        this.activeSessions.set(user.id, {
            token,
            loginTime: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            userAgent: null,
            ip: null
        });
        
        this.logger.info(`User logged in: ${email}`);
        
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                settings: user.settings
            }
        };
    }
    
    // Logout user
    logoutUser(userId) {
        this.activeSessions.delete(userId);
        this.logger.info(`User logged out: ${userId}`);
        return true;
    }
    
    // Validate session token
    validateToken(token) {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            const session = this.activeSessions.get(decoded.userId);
            
            if (!session || session.token !== token) {
                throw new Error('Invalid session');
            }
            
            if (new Date() > session.expiresAt) {
                this.activeSessions.delete(decoded.userId);
                throw new Error('Session expired');
            }
            
            return decoded;
        } catch (error) {
            this.logger.error('Token validation error:', error);
            throw error;
        }
    }
    
    // Get user profile
    getUserProfile(userId) {
        for (const [email, user] of this.users.entries()) {
            if (user.id === userId) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    profile: user.profile,
                    settings: user.settings,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin
                };
            }
        }
        return null;
    }
    
    // Update user profile
    updateUserProfile(userId, updates) {
        for (const [email, user] of this.users.entries()) {
            if (user.id === userId) {
                const allowedUpdates = ['name', 'profile', 'settings'];
                for (const key of allowedUpdates) {
                    if (updates[key]) {
                        if (key === 'profile' || key === 'settings') {
                            user[key] = { ...user[key], ...updates[key] };
                        } else {
                            user[key] = updates[key];
                        }
                    }
                }
                this.users.set(email, user);
                this.logger.info(`User profile updated: ${userId}`);
                return this.getUserProfile(userId);
            }
        }
        throw new Error('User not found');
    }
    
    // Generate session token
    generateSessionToken(user) {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name,
                roles: user.roles
            },
            SECRET_KEY,
            { expiresIn: '24h' }
        );
    }
    
    // Clean up expired sessions
    cleanupSessions() {
        const now = new Date();
        for (const [userId, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                this.activeSessions.delete(userId);
                this.logger.info(`Expired session removed for user: ${userId}`);
            }
        }
    }
    
    // Get active users count
    getActiveUsersCount() {
        return this.activeSessions.size;
    }
    
    // Get user by email
    getUserByEmail(email) {
        return this.users.get(email);
    }
    
    // Update user settings
    updateUserSettings(userId, settings) {
        for (const [email, user] of this.users.entries()) {
            if (user.id === userId) {
                user.settings = { ...user.settings, ...settings };
                this.users.set(email, user);
                this.logger.info(`User settings updated: ${userId}`);
                return user.settings;
            }
        }
        throw new Error('User not found');
    }
    
    // Change password
    async changePassword(userId, currentPassword, newPassword) {
        for (const [email, user] of this.users.entries()) {
            if (user.id === userId) {
                const isValid = await bcrypt.compare(currentPassword, user.password);
                if (!isValid) {
                    throw new Error('Current password is incorrect');
                }
                
                user.password = await bcrypt.hash(newPassword, 12);
                this.users.set(email, user);
                this.logger.info(`Password changed for user: ${userId}`);
                return true;
            }
        }
        throw new Error('User not found');
    }
    
    // Delete user account
    deleteUser(userId) {
        for (const [email, user] of this.users.entries()) {
            if (user.id === userId) {
                this.users.delete(email);
                this.activeSessions.delete(userId);
                this.logger.info(`User account deleted: ${userId}`);
                return true;
            }
        }
        throw new Error('User not found');
    }
}

module.exports = { AuthManager };
