"""
Database Models for Quantum Mus
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Player(db.Model):
    """Player model"""
    __tablename__ = 'players'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Statistics
    games_played = db.Column(db.Integer, default=0)
    games_won = db.Column(db.Integer, default=0)
    total_points = db.Column(db.Integer, default=0)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'games_played': self.games_played,
            'games_won': self.games_won,
            'total_points': self.total_points,
            'win_rate': self.games_won / self.games_played if self.games_played > 0 else 0
        }


class Game(db.Model):
    """Game model"""
    __tablename__ = 'games'
    
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(20), unique=True, nullable=False)
    game_mode = db.Column(db.String(5), default='4')
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    finished_at = db.Column(db.DateTime)
    
    # Game info
    status = db.Column(db.String(20), default='waiting')  # waiting, in_progress, finished
    winner_team = db.Column(db.String(10))
    
    # Scores
    team1_score = db.Column(db.Integer, default=0)
    team2_score = db.Column(db.Integer, default=0)
    
    # Relationships
    history = db.relationship('GameHistory', backref='game', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'room_id': self.room_id,
            'game_mode': self.game_mode,
            'status': self.status,
            'winner_team': self.winner_team,
            'team1_score': self.team1_score,
            'team2_score': self.team2_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None
        }


class GameHistory(db.Model):
    """Game history/events"""
    __tablename__ = 'game_history'
    
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('games.id'), nullable=False)
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    round_name = db.Column(db.String(20))  # MUS, GRANDE, CHICA, etc.
    event_type = db.Column(db.String(50))  # action, bet, round_end, etc.
    player_index = db.Column(db.Integer)
    data = db.Column(db.JSON)  # Flexible JSON data for event details
    
    def to_dict(self):
        return {
            'id': self.id,
            'game_id': self.game_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'round_name': self.round_name,
            'event_type': self.event_type,
            'player_index': self.player_index,
            'data': self.data
        }
